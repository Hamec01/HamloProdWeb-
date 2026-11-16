import { NextResponse } from "next/server";
import { getAdminSessionState } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "private, no-store" };
  const session = await getAdminSessionState();
  if (!session.isAuthenticated || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  }
  try {
    const contacts = await prisma.hpdg808Contact.findMany({ orderBy: { createdAt: "desc" } });
    // Quote CSV cells and neutralise spreadsheet formulas in user-supplied email.
    const cell = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? `'${value}` : value).replaceAll('"', '""')}"`;
    const rows = [
      ["email", "locale", "version", "created_at"],
      ...contacts.map((contact) => [contact.email, contact.locale, contact.releaseVersion, contact.createdAt.toISOString()]),
    ];
    return new Response("\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n"), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="hpdg808-contacts.csv"' },
    });
  } catch {
    return NextResponse.json({ error: "Contacts export unavailable." }, { status: 503, headers });
  }
}
