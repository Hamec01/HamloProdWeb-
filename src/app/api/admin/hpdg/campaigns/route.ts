import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSessionState } from "@/lib/auth/session";
import { requireHpdgAdmin } from "@/lib/hpdg/admin-guard";
import { MailNotConfiguredError } from "@/lib/hpdg/key-email";
import { campaignInputSchema, UpdateSendError } from "@/lib/hpdg/update-email";
import { campaignView, prepareCampaign, testCampaign, confirmCampaignTest, sendCampaign, refreshCampaignDelivery, CampaignError } from "@/lib/hpdg/update-campaign";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
const headers = { "Cache-Control": "no-store" };
const actionSchema = z.discriminatedUnion("action", [
  campaignInputSchema.extend({ action: z.literal("prepare") }),
  z.object({ action: z.literal("test"), releaseId: z.string().uuid(), email: z.string().trim().toLowerCase().email().max(254) }),
  z.object({ action: z.literal("confirm-test"), releaseId: z.string().uuid(), messageId: z.string().uuid() }),
  z.object({ action: z.literal("send"), releaseId: z.string().uuid() }),
  z.object({ action: z.literal("refresh"), releaseId: z.string().uuid() }),
]);

export async function GET(request: Request) {
  const session = await getAdminSessionState();
  if (!session.isAuthenticated || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  const parsed = z.string().uuid().safeParse(new URL(request.url).searchParams.get("releaseId"));
  if (!parsed.success) return NextResponse.json({ error: "Invalid release." }, { status: 400, headers });
  try { return NextResponse.json(await campaignView(parsed.data), { headers }); }
  catch { return NextResponse.json({ error: "Не удалось загрузить рассылку." }, { status: 503, headers }); }
}

export async function POST(request: Request) {
  const guard = await requireHpdgAdmin(request);
  if (!guard.ok) return guard.response;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400, headers });
  const input = parsed.data;
  try {
    switch (input.action) {
      case "prepare": await prepareCampaign({ releaseId: input.releaseId, subject: input.subject, text: input.text }, guard.context.userId); break;
      case "test": await testCampaign(input.releaseId, input.email); break;
      case "confirm-test": await confirmCampaignTest(input.releaseId, input.messageId, guard.context.userId); break;
      case "send": await sendCampaign(input.releaseId); break;
      case "refresh": await refreshCampaignDelivery(input.releaseId); break;
    }
    return NextResponse.json(await campaignView(input.releaseId), { headers });
  } catch (error) {
    if (error instanceof MailNotConfiguredError) return NextResponse.json({ error: "Почта не настроена: RESEND_API_KEY отсутствует." }, { status: 503, headers });
    // Known, safe domain errors only. Never expose DB details, keys or provider bodies.
    const message = error instanceof CampaignError || error instanceof UpdateSendError
      ? error.message : "Не удалось выполнить действие. Обнови журнал перед повтором.";
    return NextResponse.json({ error: message }, { status: 409, headers });
  }
}
