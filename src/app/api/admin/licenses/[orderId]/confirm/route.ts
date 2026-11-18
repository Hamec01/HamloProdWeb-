import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminMutation } from "@/lib/auth/guard";
import { confirmManualOrder } from "@/lib/contracts/confirm-manual";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;
  if (guard.context.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const input = await request.json().catch(() => null);
  if (input?.paymentReceived !== true) return NextResponse.json({ error: "Подтвердите получение оплаты." }, { status: 400 });
  const { orderId } = await params;
  try {
    const result = await confirmManualOrder(orderId);
    revalidatePath("/admin/licenses"); revalidatePath("/beats"); revalidatePath("/profile");
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "UNKNOWN";
    if (reason === "ORDER_NOT_FOUND") return NextResponse.json({ error: "Заявка не найдена." }, { status: 404 });
    if (reason === "BEAT_DELIVERY_MISSING") return NextResponse.json({ error: "Сначала прикрепите к биту ссылку или загрузите ZIP." }, { status: 409 });
    if (reason === "BEAT_NOT_AVAILABLE") return NextResponse.json({ error: "Бит уже продан. Проверьте оплату по этой заявке." }, { status: 409 });
    return NextResponse.json({ error: "Не удалось подтвердить заявку. Проверьте данные и договор." }, { status: 409 });
  }
}
