import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { beatFormSchema } from "@/lib/validations/beat";

function unauthorizedResponse(message: string, status = 401) {
  return NextResponse.json({ error: message }, { status });
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

  const { error } = await supabase.from("beats").insert({
    title: values.title,
    slug: values.slug,
    case_number: values.caseNumber,
    cover_palette: values.coverPalette,
    cover_image_url: values.coverImageUrl,
    cover_image_path: values.coverImagePath,
    preview_url: values.previewUrl,
    preview_storage_path: values.previewStoragePath,
    wav_file_path: values.wavFilePath,
    zip_file_path: values.zipFilePath,
    bpm: values.bpm,
    mood: values.mood,
    description: values.description,
    duration: values.duration,
    status: values.status,
    price_usd: values.priceUsd,
    featured: values.featured,
    available_for_download: values.availableForDownload,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath("/");
  revalidatePath("/beats");
  revalidatePath("/admin/beats");

  return NextResponse.json({ ok: true });
}