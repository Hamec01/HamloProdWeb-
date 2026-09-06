/**
 * Real (Prisma / Argon2 / DB-throttle) implementations of the auth-service ports.
 * Server-only — imported by the Route Handlers in src/app/api/admin/auth/*.
 */

import { prisma } from "@/lib/db/client";
import { createAdminSession, revokeAdminSession } from "@/lib/auth/session";
import { DUMMY_PASSWORD_HASH, verifyPassword } from "@/lib/auth/password";
import {
  checkThrottle,
  clearEmailThrottle,
  emailThrottleKey,
  ipThrottleKey,
  recordFailedAttempt,
} from "@/lib/auth/throttle";
import type { LoginPorts, LogoutPorts, ThrottleKeys } from "@/lib/auth/admin-auth-service";

export function loginPorts(): LoginPorts {
  return {
    findUserByEmail: (email) =>
      prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true, role: true, passwordHash: true },
      }),
    verifyPassword,
    createSession: async (userId, meta) => {
      const session = await createAdminSession(userId, meta);
      return { token: session.token, expiresAt: session.expiresAt };
    },
    throttleKeys: (email, ip): ThrottleKeys => ({
      emailKey: emailThrottleKey(email),
      ipKey: ipThrottleKey(ip),
    }),
    checkThrottle,
    recordFailedAttempt,
    clearEmailThrottle,
    dummyHash: DUMMY_PASSWORD_HASH,
  };
}

export function logoutPorts(): LogoutPorts {
  return {
    revokeSession: (token) => revokeAdminSession({ token }),
  };
}
