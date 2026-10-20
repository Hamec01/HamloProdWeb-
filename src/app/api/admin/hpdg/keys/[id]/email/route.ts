import { NextResponse } from "next/server";
import { requireHpdgAdmin } from "@/lib/hpdg/admin-guard";
import { buildKeyEmail, getMailConfig, MailNotConfiguredError, sendEmail } from "@/lib/hpdg/key-email";
import { emailLicenseKey, listLicenseKeys } from "@/lib/hpdg/postgres";
import { isUuid } from "@/lib/storage/keys";

export const runtime = "nodejs";

/** Send (or resend) the key email to the key's address. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireHpdgAdmin(request);
  if (!guard.ok) return guard.response;
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  try {
    const config = getMailConfig();
    await emailLicenseKey(id, ({ email, key }) => sendEmail(email, buildKeyEmail({ key }), config).then(() => undefined));
    return NextResponse.json({ keys: await listLicenseKeys() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof MailNotConfiguredError) return NextResponse.json({ error: "Почта не настроена: нет RESEND_API_KEY в Vercel." }, { status: 503 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send the email." }, { status: 500 });
  }
}
