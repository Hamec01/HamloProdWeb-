/**
 * Verify a HamloProd database endpoint end to end — meant to be run against the
 * Vercel Preview connection string once PgBouncer + TLS + DNS are wired up
 * (M1.3). Prints PASS/FAIL only; never echoes the password or the signed URL.
 *
 *   DB_CHECK_URL='postgresql://hamloprod_app:***@db.hamloprod.org:6432/hamloprod?sslmode=verify-full&pgbouncer=true' \
 *     npx tsx scripts/db-connection-check.mts
 *
 * Falls back to DATABASE_URL when DB_CHECK_URL is unset (so it also works from
 * the VPS against the local database / a loopback PgBouncer).
 *
 * DB_CHECK_ADDR="host:port" overrides only where the raw TLS probe DIALS, while
 * the certificate is still checked against the URL's hostname — use it to verify
 * the endpoint's cert before the db.hamloprod.org DNS record is cut over.
 *
 * Checks:
 *   1. TCP reachable on host:port
 *   2. PostgreSQL STARTTLS: server offers TLS; print the presented certificate
 *      (issuer / SAN / notAfter) and whether SAN covers the host
 *   3. Auth + role: connects, current_user is the app role
 *   4. Least privilege: CREATE TABLE is denied for the app role
 *   5. Connection budget: the app role has a finite CONNECTION LIMIT
 *   6. Pooler transport: pg_stat_ssl for this backend (PgBouncer→Postgres hop)
 */

import net from "node:net";
import tls from "node:tls";
import { PrismaClient } from "@prisma/client";

const rawUrl = process.env.DB_CHECK_URL ?? process.env.DATABASE_URL ?? "";
if (!rawUrl) {
  console.error("set DB_CHECK_URL (or DATABASE_URL)");
  process.exit(2);
}

const u = new URL(rawUrl);
const host = u.hostname;
const port = Number(u.port || "5432");
const [dialHost, dialPort] = (() => {
  const a = process.env.DB_CHECK_ADDR;
  if (!a) return [host, port] as const;
  const [h, p] = a.split(":");
  return [h || host, Number(p || port)] as const;
})();
const sslmode = u.searchParams.get("sslmode") ?? "(unset)";
const masked = `${u.protocol}//${u.username}:***@${host}:${port}${u.pathname}?sslmode=${sslmode}${
  u.searchParams.has("pgbouncer") ? "&pgbouncer=" + u.searchParams.get("pgbouncer") : ""
}`;

let pass = 0;
let fail = 0;
const ok = (m: string) => {
  console.log(`PASS  ${m}`);
  pass++;
};
const bad = (m: string) => {
  console.log(`FAIL  ${m}`);
  fail++;
};

console.log(`target: ${masked}`);

// ---- 1 + 2: TCP + PostgreSQL STARTTLS + certificate ------------------------
async function tcpAndTls(): Promise<void> {
  const label = dialHost === host && dialPort === port ? `${host}:${port}` : `${dialHost}:${dialPort} (as ${host})`;
  const socket = await new Promise<net.Socket>((resolve, reject) => {
    const s = net.connect({ host: dialHost, port: dialPort });
    s.setTimeout(8000);
    s.once("connect", () => resolve(s));
    s.once("timeout", () => reject(new Error("tcp timeout")));
    s.once("error", reject);
  }).catch((e) => {
    bad(`tcp connect ${label} — ${(e as Error).message}`);
    return null;
  });
  if (!socket) return;
  ok(`tcp connect ${label}`);

  // SSLRequest: int32 length=8, int32 code=80877103
  const sslRequest = Buffer.alloc(8);
  sslRequest.writeInt32BE(8, 0);
  sslRequest.writeInt32BE(80877103, 4);

  const supportsTls = await new Promise<boolean>((resolve) => {
    socket.once("data", (buf) => resolve(buf[0] === 0x53 /* 'S' */));
    socket.write(sslRequest);
  });

  if (!supportsTls) {
    bad("server declined STARTTLS (replied 'N') — TLS not available on this endpoint");
    socket.destroy();
    return;
  }
  ok("server offers PostgreSQL STARTTLS");

  const secure = await new Promise<tls.TLSSocket | null>((resolve) => {
    const t = tls.connect(
      { socket, servername: host, rejectUnauthorized: false },
      () => resolve(t),
    );
    t.once("error", () => resolve(null));
  });
  if (!secure) {
    bad("TLS handshake failed");
    socket.destroy();
    return;
  }

  const cert = secure.getPeerCertificate();
  const authorized = secure.authorized;
  const sans = (cert.subjectaltname ?? "").split(",").map((s) => s.trim());
  const sanCovers = sans.some((s) => s.toLowerCase() === `dns:${host.toLowerCase()}`);
  const issuer = cert.issuer?.O ? `${cert.issuer.O}${cert.issuer.CN ? " / " + cert.issuer.CN : ""}` : "(unknown)";
  const selfSigned = JSON.stringify(cert.issuer) === JSON.stringify(cert.subject);

  console.log(`      cert issuer: ${issuer}`);
  console.log(`      cert SAN:    ${cert.subjectaltname ?? "(none)"}`);
  console.log(`      cert valid:  ${cert.valid_from} … ${cert.valid_to}`);
  console.log(`      node trust:  ${authorized ? "authorized" : "NOT authorized (" + (secure.authorizationError ?? "") + ")"}`);

  if (sanCovers) ok(`certificate SAN covers ${host}`);
  else bad(`certificate SAN does not cover ${host}`);

  if (new Date(cert.valid_to).getTime() < Date.now()) bad("certificate is expired");
  else ok("certificate not expired");

  if (selfSigned) {
    bad("certificate is self-signed — Vercel sslmode=verify-full will reject it (fine for a loopback test only)");
  } else if (authorized) {
    ok("certificate chains to a trusted CA (verify-full will pass)");
  } else {
    console.log("      note: not trusted by this Node's store; ok if you pin ?sslrootcert=");
  }

  secure.destroy();
}

// ---- 3..6: through Prisma --------------------------------------------------
async function viaPrisma(): Promise<void> {
  const prisma = new PrismaClient({ datasourceUrl: rawUrl, log: ["error"] });
  try {
    const who = await prisma.$queryRawUnsafe<Array<{ current_user: string; ssl: string }>>(
      "SELECT current_user, current_setting('ssl', true) AS ssl",
    );
    ok(`connected; current_user = ${who[0]?.current_user}`);
    if (who[0]?.current_user === "hamloprod_app") ok("connected as the least-privilege app role");
    else bad(`expected hamloprod_app, got ${who[0]?.current_user}`);

    const lim = await prisma.$queryRawUnsafe<Array<{ rolconnlimit: number }>>(
      "SELECT rolconnlimit FROM pg_roles WHERE rolname = current_user",
    );
    const n = lim[0]?.rolconnlimit ?? -1;
    if (n > 0) ok(`app role CONNECTION LIMIT = ${n}`);
    else bad(`app role has no CONNECTION LIMIT (rolconnlimit = ${n}) — run deploy/preview-db/01-connection-limits.sql`);

    try {
      await prisma.$executeRawUnsafe("CREATE TABLE _dbcheck_probe (id int)");
      await prisma.$executeRawUnsafe("DROP TABLE _dbcheck_probe");
      bad("app role could CREATE TABLE — it must not have DDL");
    } catch {
      ok("DDL denied for the app role (CREATE TABLE rejected)");
    }

    try {
      const s = await prisma.$queryRawUnsafe<Array<{ ssl: boolean; version: string | null }>>(
        "SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()",
      );
      if (s[0]) {
        console.log(`      backend hop TLS (PgBouncer→Postgres): ssl=${s[0].ssl} ${s[0].version ?? ""}`.trimEnd());
      }
    } catch {
      /* pg_stat_ssl not readable through the pooler — non-fatal */
    }
  } catch (e) {
    bad(`Prisma connection failed — ${(e as Error).message.split("\n")[0]}`);
  } finally {
    await prisma.$disconnect();
  }
}

await tcpAndTls();
await viaPrisma();

console.log(`\nDB CHECK: ${pass}/${pass + fail} passed`);
process.exit(fail === 0 ? 0 : 1);
