import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { requireHpdgAdmin } from "@/lib/hpdg/admin-guard";
import { listReleases, makeReleaseCurrent } from "@/lib/hpdg/postgres";
import { installerObjectKey, releaseInputSchema } from "@/lib/hpdg/release";
import { getS3Config, isStorageConfigured } from "@/lib/storage/config";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";

export const runtime = "nodejs";

/** Register a release whose installer is already in hamloprod-private/hpdg/ (size checked against the stored object). */
export async function POST(request: Request) {
  const guard = await requireHpdgAdmin(request);
  if (!guard.ok) return guard.response;
  if (!isStorageConfigured()) return NextResponse.json({ error: "Object storage is not configured." }, { status: 503 });

  const parsed = releaseInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  const input = parsed.data;
  const objectKey = installerObjectKey(input.fileName);

  try {
    const head = await new ContaboS3Storage(getS3Config()).headObject({ visibility: "private", key: objectKey });
    if (!head) return NextResponse.json({ error: `${objectKey} is not in storage yet. Upload the installer first.` }, { status: 409 });
    if (head.contentLength !== input.size) {
      return NextResponse.json({ error: `Size mismatch: storage has ${head.contentLength} bytes, form says ${input.size}.` }, { status: 409 });
    }

    const created = await prisma.hpdgRelease.create({
      data: { version: input.version, title: input.title, notes: input.notes, page: input.page, objectKey, sha256: input.sha256, size: input.size },
      select: { id: true },
    });
    if (input.makeCurrent) await makeReleaseCurrent(created.id);
    return NextResponse.json({ releases: await listReleases() }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: `Version ${input.version} already exists.` }, { status: 409 });
    }
    return NextResponse.json({ error: "Could not save the release." }, { status: 500 });
  }
}
