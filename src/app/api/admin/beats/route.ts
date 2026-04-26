import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { publishBeatToTelegram } from "@/lib/telegram/beats";
import { hasAllowedPreviewExtension, isAllowedPreviewMimeType, isHttpsUrl } from "@/lib/validations/preview-audio";
import { beatFormSchema } from "@/lib/validations/beat";

function unauthorizedResponse(message: string, status = 401) {
  return NextResponse.json({ error: message }, { status });
}

function revalidateBeatPaths(slug?: string) {
  revalidatePath("/");
  revalidatePath("/beats");
  revalidatePath("/admin/beats");
  revalidatePath("/ru/beats");
  revalidatePath("/en/beats");

  if (!slug) {
    return;
  }

  revalidatePath(`/beats/${slug}`);
  revalidatePath(`/checkout/${slug}`);
  revalidatePath(`/ru/beats/${slug}`);
  revalidatePath(`/en/beats/${slug}`);
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return unauthorizedResponse("Supabase env is not configured.", 503);
  }

  const session = await getAdminSessionState();
  if (!session.isAuthenticated) {
    return unauthorizedResponse("Unauthorized");
  }

  const body = await request.json();
  const parsed = beatFormSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const values = parsed.data;
  const previewSizeBytes =
    values.previewSizeBytes === null || values.previewSizeBytes === ""
      ? null
      : typeof values.previewSizeBytes === "number"
        ? values.previewSizeBytes
        : Number(values.previewSizeBytes);

  if (values.previewUrl && !isHttpsUrl(values.previewUrl)) {
    return NextResponse.json({ error: "Preview URL must start with https://" }, { status: 400 });
  }

  if (values.previewMimeType && !isAllowedPreviewMimeType(values.previewMimeType)) {
    return NextResponse.json({ error: "Unsupported preview mime type." }, { status: 400 });
  }

  if (previewSizeBytes !== null && (!Number.isInteger(previewSizeBytes) || previewSizeBytes < 0)) {
    return NextResponse.json({ error: "Invalid preview file size." }, { status: 400 });
  }

  const previewExtensionSource = values.previewFileName || values.previewUrl || null;
  if (values.previewUrl && !hasAllowedPreviewExtension(previewExtensionSource)) {
    return NextResponse.json({ error: "Unsupported preview file extension." }, { status: 400 });
  }

  const { error } = await supabase.from("beats").insert({
    title: values.title,
    slug: values.slug,
    case_number: values.caseNumber,
    cover_palette: values.coverPalette,
    cover_image_url: values.coverImageUrl,
    cover_image_path: values.coverImagePath,
    preview_url: values.previewUrl,
    preview_storage_path: values.previewStoragePath,
    preview_file_name: values.previewFileName,
    preview_mime_type: values.previewMimeType,
    preview_size_bytes: previewSizeBytes,
    wav_file_path: values.wavFilePath,
    zip_file_path: values.zipFilePath,
    genre: values.genre,
    substyle: values.substyle,
    bpm: values.bpm,
    mood: values.mood,
    description: values.description,
    duration: values.duration,
    status: values.status,
    price_usd: values.priceUsd,
    price_rub: values.priceRub,
    featured: values.featured,
    available_for_download: values.availableForDownload,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  try {
    await publishBeatToTelegram({
      title: values.title,
      slug: values.slug,
      genre: values.genre,
      substyle: values.substyle,
      bpm: values.bpm,
      mood: values.mood,
      priceRub: values.priceRub,
      priceUsd: values.priceUsd,
      coverImageUrl: values.coverImageUrl,
      previewUrl: values.previewUrl,
    });
  } catch (publishError) {
    console.error("[telegram] failed to publish beat", {
      error: publishError,
      slug: values.slug,
    });
  }

  revalidateBeatPaths(values.slug);

  return NextResponse.json({ ok: true });
}