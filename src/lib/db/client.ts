/**
 * Prisma client for the self-hosted PostgreSQL backend (migration phase M1).
 *
 * Server-only. A single `PrismaClient` is reused across hot reloads and across
 * serverless invocations on the same instance so the connection pool is not
 * re-created on every request. New features import `prisma` from here; they must
 * not go through Supabase.
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
