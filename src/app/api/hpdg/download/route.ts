import { NextResponse } from "next/server";
import { clientIp } from "@/lib/auth/request";
import { handleDownloadRequest } from "@/lib/hpdg/download-service";
import { postgresDownloadPorts } from "@/lib/hpdg/postgres";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Buyer with a license key → short-lived presigned installer link (contract: HPDG docs/SITE_UPDATES_TASK.md). */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const country = request.headers.get("x-vercel-ip-country")?.slice(0, 8) || null;
  try {
    const result = await handleDownloadRequest(body, { ip: clientIp(request), country }, postgresDownloadPorts);
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
