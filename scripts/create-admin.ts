/**
 * Create or update the bootstrap administrator.
 *
 * Reads ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD from the environment
 * ONLY — never from a CLI argument (argv is visible in `ps` and shell history).
 * The password is hashed with Argon2id and never printed.
 *
 * Safe run (bash — the leading space keeps it out of history when HISTCONTROL
 * includes `ignorespace`):
 *
 *    read -rs -p 'admin password: ' ADMIN_BOOTSTRAP_PASSWORD; echo
 *    ADMIN_BOOTSTRAP_EMAIL='you@example.com' ADMIN_BOOTSTRAP_PASSWORD="$ADMIN_BOOTSTRAP_PASSWORD" \
 *      npx tsx scripts/create-admin.ts
 *    unset ADMIN_BOOTSTRAP_PASSWORD
 *
 * Idempotent: re-running upserts the same row (by normalised email) and resets
 * the password + role. It does NOT revoke existing sessions.
 */

import { prisma } from "@/lib/db/client";
import { assertPasswordPolicy, hashPassword } from "@/lib/auth/password";

async function main() {
  const rawEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const rawPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (!rawEmail || !rawPassword) {
    console.error("ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD must both be set in the environment.");
    process.exit(1);
  }

  const email = rawEmail.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("ADMIN_BOOTSTRAP_EMAIL is not a valid email address.");
    process.exit(1);
  }

  try {
    assertPasswordPolicy(rawPassword);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Password does not meet the policy.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(rawPassword);

  const user = await prisma.user.upsert({
    where: { email },
    create: { email, passwordHash, role: "ADMIN", emailVerifiedAt: new Date() },
    update: { passwordHash, role: "ADMIN" },
    select: { id: true, email: true, role: true, createdAt: true },
  });

  console.log(`ok: ${user.role} ${user.email} (${user.id})`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("failed:", error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
