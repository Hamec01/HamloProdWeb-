import { NextResponse } from "next/server";
import { requireAdminMutation } from "@/lib/auth/guard";
import { ensureOrderLicense } from "@/lib/contracts/issue";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const maxDuration = 120;

function noStore(body: unknown, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;
  if (guard.context.role !== "ADMIN") return noStore({ error: "Only an admin can access manual sale licenses." }, 403);

  const { orderId } = await params;
  const order = await prisma.order.findFirst({
    where: { id: orderId, licenseType: "exclusive", status: { in: ["paid", "pending_free_checkout"] } },
    select: {
      id: true,
      contractPdfKey: true,
      contract: { select: { htmlSnapshot: true } },
    },
  });
  if (!order) return noStore({ error: "Manual license sale not found." }, 404);

  try {
    const pdf = await ensureOrderLicense(order.id);
    return noStore({ downloadUrl: pdf.downloadUrl });
  } catch (error) {
    console.error("[admin:licenses] PDF retrieval failed", {
      orderId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return noStore({ error: "Failed to prepare the license PDF." }, 500);
  }
}
