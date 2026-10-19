import { NextResponse } from "next/server";
import { requireAdminMutation, type AdminMutationGuard } from "@/lib/auth/guard";

/** HPDG keys and releases are ADMIN-only (not EDITOR): keys are buyer credentials. */
export async function requireHpdgAdmin(request: Request): Promise<AdminMutationGuard> {
  const guard = await requireAdminMutation(request);
  if (guard.ok && guard.context.role !== "ADMIN") {
    return { ok: false, status: 403, response: NextResponse.json({ error: "Only ADMIN can manage HPDG keys and releases." }, { status: 403 }) };
  }
  return guard;
}
