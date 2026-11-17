import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminMutation } from "@/lib/auth/guard";
import { createManualExclusiveLicense } from "@/lib/contracts/manual-license";
import { adminLicenseCreateSchema } from "@/lib/validations/admin-license";

export const runtime = "nodejs";
export const maxDuration = 120;

function noStore(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: Request) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;
  if (guard.context.role !== "ADMIN") return noStore({ error: "Only an admin can record a manual sale." }, 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return noStore({ error: "Invalid JSON body." }, 400);
  }

  const parsed = adminLicenseCreateSchema.safeParse(body);
  if (!parsed.success) {
    return noStore({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, 400);
  }

  try {
    const result = await createManualExclusiveLicense(parsed.data);
    revalidatePath("/admin/licenses");
    revalidatePath("/admin/beats");
    revalidatePath("/beats");
    revalidatePath(`/beats/${result.beatSlug}`);
    return noStore(result, 201);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (reason === "BUYER_NOT_FOUND" || reason === "BUYER_EMAIL_MISMATCH") return noStore({ error: "Проверьте выбранный аккаунт и email покупателя." }, 400);
    if (reason === "BEAT_NOT_FOUND") return noStore({ error: "Beat not found." }, 404);
    if (reason === "BEAT_NOT_AVAILABLE") return noStore({ error: "This beat is no longer available for an exclusive sale." }, 409);
    if (reason.startsWith("SELLER_CONFIG_MISSING") || reason.startsWith("SELLER_SIGNATURE_MISSING")) {
      return noStore({ error: "Seller contract details and signature must be configured first." }, 503);
    }
    return noStore({ error: "Failed to create the manual license sale." }, 500);
  }
}
