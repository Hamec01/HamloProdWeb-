/**
 * Real (Prisma / Argon2 / bcrypt / DB-throttle) implementations of the buyer
 * auth-service ports. Server-only — imported by src/app/api/auth/*.
 */

import { prisma } from "@/lib/db/client";
import { createPublicSession, revokePublicSession } from "@/lib/auth/public-session-store";
import {
  DUMMY_PASSWORD_HASH,
  hashBuyerPassword,
  isLegacyBcryptHash,
  verifyPasswordAnyFormat,
} from "@/lib/auth/password";
import {
  checkThrottle,
  clearEmailThrottle,
  emailThrottleKey,
  ipThrottleKey,
  recordFailedAttempt,
} from "@/lib/auth/throttle";
import type { PublicAuthPorts, ThrottleKeys } from "@/lib/auth/public-auth-service";

export function publicAuthPorts(): PublicAuthPorts {
  return {
    findUserByEmail: (email) =>
      prisma.user.findUnique({ where: { email }, select: { id: true, email: true, passwordHash: true } }),
    createUser: (input) =>
      prisma.user.create({
        data: { email: input.email, passwordHash: input.passwordHash, role: "USER", emailVerifiedAt: null },
        select: { id: true, email: true, passwordHash: true },
      }),
    verifyPassword: verifyPasswordAnyFormat,
    isLegacyHash: isLegacyBcryptHash,
    hashPassword: hashBuyerPassword,
    upgradePasswordHash: async (userId, passwordHash) => {
      await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    },
    recordSignIn: async (userId) => {
      await prisma.user.update({ where: { id: userId }, data: { lastSignInAt: new Date() } });
    },
    createSession: async (userId, meta) => {
      const session = await createPublicSession(userId, meta);
      return { token: session.token, expiresAt: session.expiresAt };
    },
    throttleKeys: (email, ip): ThrottleKeys => ({
      emailKey: emailThrottleKey(`buyer:${email}`),
      ipKey: ipThrottleKey(`buyer:${ip}`),
    }),
    checkThrottle,
    recordFailedAttempt,
    clearEmailThrottle,
    dummyHash: DUMMY_PASSWORD_HASH,
  };
}

export function publicLogoutPorts() {
  return { revokeSession: (token: string) => revokePublicSession(token) };
}
