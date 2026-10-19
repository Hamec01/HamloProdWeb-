import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { HPDG_PLATFORM, publicRelease } from "@/lib/hpdg/release";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public: current HPDG release for the plugin's Update button. Never exposes the file. */
export async function GET() {
  try {
    const release = await prisma.hpdgRelease.findFirst({
      where: { isCurrent: true, platform: HPDG_PLATFORM },
      select: { version: true, title: true, notes: true, page: true },
    });
    if (!release) {
      return NextResponse.json({ error: "no_release" }, { status: 404, headers: { "Cache-Control": "public, s-maxage=60" } });
    }
    return NextResponse.json(publicRelease(release), { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" } });
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
