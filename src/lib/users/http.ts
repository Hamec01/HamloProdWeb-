import { NextResponse } from "next/server";
import { getAdminSessionState } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/origin";

export async function userAdminGuard(request: Request, mutation = false) {
  if (mutation && !isSameOriginRequest(request)) return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  try {
    const session = await getAdminSessionState();
    if (!session.isAuthenticated || !session.userId) return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    if (session.role !== "ADMIN") return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    return { ok: true as const, adminId: session.userId };
  } catch { return { ok: false as const, response: NextResponse.json({ error: "Authentication unavailable" }, { status: 503 }) }; }
}
export function userError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error && error.code === "P2002" ? "REQUEST_CONFLICT" : error instanceof Error ? error.message : "UNKNOWN";
  const errors: Record<string, [number, string]> = {
    FORBIDDEN: [403, "Нет доступа."], USER_NOT_FOUND: [404, "Пользователь не найден."],
    BAD_CURSOR: [400, "Неверная страница истории."], REQUEST_CONFLICT: [409, "Эта операция уже отправлена с другими данными. Обновите страницу."],
    INVALID_GRANT: [400, "Укажите от 1 до 10000 поинтов и причину начисления."], BALANCE_LIMIT: [409, "Достигнут предел баланса."],
  };
  const [status, message] = errors[code] || [500, "Не удалось сохранить. Повторите попытку."];
  if (status === 500) console.error("User management request failed", error instanceof Error ? error.name : "UnknownError");
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
}
export const privateHeaders = { "Cache-Control": "private, no-store" };
