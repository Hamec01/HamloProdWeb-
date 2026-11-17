import { NextResponse } from "next/server";
import { getPublicSessionState } from "@/lib/auth/public-session";
import { getAdminSessionState } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/origin";
import type { OrderActor } from "./reservations";

export async function orderActor() : Promise<OrderActor | null> {
  const admin = await getAdminSessionState();
  if (admin.isAuthenticated && admin.userId && admin.role === "ADMIN") return { userId: admin.userId, role: "admin" };
  const buyer = await getPublicSessionState();
  return buyer.isAuthenticated && buyer.userId ? { userId: buyer.userId, role: "buyer" } : null;
}

export async function requireOrderActor(request: Request, mutation: boolean) {
  if (mutation && !isSameOriginRequest(request)) return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  try {
    const actor = await orderActor();
    if (!actor) return { ok: false as const, response: NextResponse.json({ error: "Login required." }, { status: 401 }) };
    return { ok: true as const, actor };
  } catch { return { ok: false as const, response: NextResponse.json({ error: "Authentication unavailable." }, { status: 503 }) }; }
}

export function orderError(error: unknown) {
  const reason = error instanceof Error ? error.message : "UNKNOWN";
  const messages: Record<string, string> = {
    ORDER_NOT_FOUND: "Заявка не найдена.", BEAT_NOT_FOUND: "Бит не найден.",
    BEAT_RESERVED: "Бит уже забронирован другим покупателем.", BEAT_NOT_AVAILABLE: "Бит продан или недоступен.",
    BEAT_PAYMENT_PENDING: "По этому биту уже оформляется оплата.", ORDER_NOT_READY: "Сначала заполните данные для лицензии и примите условия.",
    INSUFFICIENT_POINTS: "Для бесплатного бита нужно 100 поинтов. Проверьте баланс.", NOT_A_POINTS_ORDER: "Сначала выберите обмен 100 поинтов при оформлении заявки.", BAD_CURSOR: "Неверная страница сообщений.",
  };
  return NextResponse.json({ error: messages[reason] || "Не удалось выполнить действие. Повторите попытку.", code: reason in messages ? reason : "REQUEST_FAILED" }, { status: reason === "ORDER_NOT_FOUND" || reason === "BEAT_NOT_FOUND" ? 404 : reason in messages ? 409 : 500, headers: { "Cache-Control": "no-store" } });
}
