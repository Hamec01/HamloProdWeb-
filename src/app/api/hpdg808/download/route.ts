import { NextResponse } from "next/server";
import { isSameOriginRequest } from "@/lib/auth/origin";
import { prisma } from "@/lib/db/client";
import { hpdg808DownloadSchema } from "@/lib/hpdg808/contact";
import { hpdg808Release } from "@/lib/hpdg808/release";
import { getS3Config } from "@/lib/storage/config";
import { ContaboS3Storage } from "@/lib/storage/contabo-s3-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "private, no-store" };

async function prepareDownload() {
  const storage = new ContaboS3Storage(getS3Config());
  const object = { visibility: "private", key: hpdg808Release.objectKey } as const;
  // Bytes are verified at publication. Signing is local, so slow storage
  // metadata requests cannot delay the dialog or the optional email capture.
  return storage.createSignedDownloadUrl(object, {
    expiresInSeconds: 300,
    downloadName: hpdg808Release.fileName,
  });
}

function unavailable() {
  return NextResponse.json(
    { error: "Download temporarily unavailable. Please try again later." },
    { status: 503, headers },
  );
}

// HPDG 808 is free: no account, payment, or license key is required.
// Keep the installer in private storage and issue a fresh five-minute URL.
export async function GET() {
  try {
    const signed = await prepareDownload();
    return new NextResponse(null, {
      status: 303,
      headers: { ...headers, Location: signed.url },
    });
  } catch {
    return unavailable();
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403, headers });
  }
  let body: unknown;
  try {
    if (Number(request.headers.get("content-length")) > 2048) throw new Error("Body too large");
    const text = await request.text();
    if (text.length > 2048) throw new Error("Body too large");
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  }
  const parsed = hpdg808DownloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email or leave it blank." }, { status: 400, headers });
  }
  try {
    const signed = await prepareDownload();
    const { email, locale } = parsed.data;
    let emailSaved = false;
    if (email) {
      // Optional contact capture must never block access to this free release.
      try {
        await prisma.hpdg808Contact.upsert({
          where: { email },
          create: { email, locale, releaseVersion: hpdg808Release.version },
          update: { locale, releaseVersion: hpdg808Release.version },
        });
        emailSaved = true;
      } catch {
        emailSaved = false;
      }
    }
    return NextResponse.json({ url: signed.url, emailSaved }, { headers });
  } catch {
    return unavailable();
  }
}
