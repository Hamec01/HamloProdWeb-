import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHpdgAdmin } from "@/lib/hpdg/admin-guard";
import { issueLicenseKeys, listLicenseKeys, type IssueRequest } from "@/lib/hpdg/postgres";

export const runtime = "nodejs";

const email = z.string().trim().toLowerCase().email("Invalid email.").max(254);
const schema = z.object({
  emails: z.array(email).max(500).default([]),
  payments: z
    .array(z.object({ email, paymentId: z.string().trim().min(3).max(255), customerId: z.string().trim().max(255).nullish() }))
    .max(1000)
    .default([]),
  note: z.string().trim().max(500).nullish(),
});

/** Issue keys: by email (manual) or from Stripe payments exported as CSV. */
export async function POST(request: Request) {
  const guard = await requireHpdgAdmin(request);
  if (!guard.ok) return guard.response;

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  const { emails, payments, note } = parsed.data;
  if (emails.length + payments.length === 0) return NextResponse.json({ error: "Nothing to issue." }, { status: 400 });

  const requests: IssueRequest[] = [
    ...emails.map((value) => ({ email: value, note, source: "manual" as const })),
    ...payments.map((p) => ({ email: p.email, note, source: "stripe-csv" as const, stripePaymentId: p.paymentId, stripeCustomerId: p.customerId ?? null })),
  ];
  try {
    const outcomes = await issueLicenseKeys(requests, guard.context.userId);
    return NextResponse.json({ outcomes, keys: await listLicenseKeys() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not issue keys." }, { status: 500 });
  }
}
