/**
 * Admin role predicate. Pure — no Prisma runtime import (type-only), so it is safe
 * to use from unit-tested service code.
 */

import type { UserRole } from "@prisma/client";

export const ADMIN_ROLES = ["ADMIN", "EDITOR"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export function isAdminRole(role: UserRole | string | null | undefined): role is AdminRole {
  return typeof role === "string" && (ADMIN_ROLES as readonly string[]).includes(role);
}
