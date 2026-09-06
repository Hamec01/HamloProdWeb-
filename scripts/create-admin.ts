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
 * Idempotent. In one transaction it upserts the row (by normalised email), sets
 * the password + ADMIN role, and revokes every active session of that user (so a
 * changed password immediately invalidates old logins). The first run also
 * simply creates the row (0 sessions revoked).
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

  const { user, revokedCount } = await prisma.$transaction(async (tx) => {
    const upserted = await tx.user.upsert({
      where: { email },
      create: { email, passwordHash, role: "ADMIN", emailVerifiedAt: new Date() },
      update: { passwordHash, role: "ADMIN" },
      select: { id: true, email: true, role: true },
    });

    const revoked = await tx.session.updateMany({
      where: { userId: upserted.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { user: upserted, revokedCount: revoked.count };
  });

  console.log(`ok: ${user.role} ${user.email} (${user.id}) — revoked ${revokedCount} active session(s)`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("failed:", error instanceof Error ? error.message : error);
  await prisma.$disconnect();
  process.exit(1);
});
