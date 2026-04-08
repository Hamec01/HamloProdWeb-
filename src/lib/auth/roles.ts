import type { UserRole } from "@/types";

export const adminRoles: UserRole[] = ["admin", "editor"];

export function canManageContent(role: UserRole) {
  return adminRoles.includes(role);
}