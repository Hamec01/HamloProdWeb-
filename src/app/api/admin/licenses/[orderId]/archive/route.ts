import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminMutation } from "@/lib/auth/guard";
import { setRequestArchived } from "@/lib/orders/admin-archive";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ orderId: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;
  if (guard.context.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { orderId } = await params;
  const input = z.object({ archived: z.boolean() }).strict().safeParse(await request.json().catch(() => null));
  if (!z.uuid().safeParse(orderId).success || !input.success) return NextResponse.json({ error: "Некорректная заявка." }, { status: 400 });
  try {
    if (!await setRequestArchived(orderId, input.data.archived)) return NextResponse.json({ error: "Можно убрать только неоплаченную заявку с сайта." }, { status: 409 });
    revalidatePath("/admin/licenses");
    return NextResponse.json({ archived: input.data.archived }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Не удалось обновить список заявок. Повторите попытку." }, { status: 503 });
  }
}
