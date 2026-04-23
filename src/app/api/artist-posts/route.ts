import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getPublicSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { POST_FILES_BUCKET, buildStoragePath } from "@/lib/storage/media";

const schema = z.object({
  artistId: z.string().uuid(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(5000),
  imageUrl: z.string().url().optional().nullable(),
  imagePath: z.string().optional().nullable(),
  audioUrl: z.string().url().optional().nullable(),
  audioPath: z.string().optional().nullable(),
  published: z.boolean().default(true),
});

async function uploadFile(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  file: File,
  kind: "image" | "audio",
  artistId: string
): Promise<{ url: string; path: string } | null> {
  const path = buildStoragePath(artistId, `post-${kind}`, file.name);
  const { data, error } = await supabase.storage
    .from(POST_FILES_BUCKET)
    .upload(path, file, { upsert: false });
  if (error || !data) return null;
  const { data: urlData } = supabase.storage.from(POST_FILES_BUCKET).getPublicUrl(data.path);
  return { url: urlData.publicUrl, path: data.path };
}

export async function POST(request: Request) {
  if (!hasSupabaseEnv()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  const session = await getPublicSessionState();
  if (!session.isAuthenticated || !session.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const isFormData = contentType.includes("multipart/form-data");

  let rawPayload: Record<string, unknown>;
  let imageFile: File | null = null;
  let audioFile: File | null = null;

  if (isFormData) {
    const formData = await request.formData();
    rawPayload = {
      artistId: formData.get("artistId"),
      title: formData.get("title"),
      body: formData.get("body"),
      published: formData.get("published") !== "false",
    };
    const imgEntry = formData.get("image");
    const audEntry = formData.get("audio");
    if (imgEntry instanceof File && imgEntry.size > 0) imageFile = imgEntry;
    if (audEntry instanceof File && audEntry.size > 0) audioFile = audEntry;
  } else {
    rawPayload = await request.json();
  }

  const parsed = schema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const { artistId, title, body, imageUrl: payloadImageUrl, imagePath: payloadImagePath, audioUrl: payloadAudioUrl, audioPath: payloadAudioPath, published } = parsed.data;

  // Verify user is admin or linked artist
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, artist_id")
    .eq("id", session.userId)
    .maybeSingle<{ role: string; artist_id: string | null }>();

  const isAdmin = profile?.role === "admin" || profile?.role === "editor";
  const isOwner = profile?.artist_id === artistId;

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Upload files if provided
  let imageUrl = payloadImageUrl ?? null;
  let imagePath = payloadImagePath ?? null;
  let audioUrl = payloadAudioUrl ?? null;
  let audioPath = payloadAudioPath ?? null;

  if (imageFile) {
    const uploaded = await uploadFile(supabase, imageFile, "image", artistId);
    if (uploaded) { imageUrl = uploaded.url; imagePath = uploaded.path; }
  }
  if (audioFile) {
    const uploaded = await uploadFile(supabase, audioFile, "audio", artistId);
    if (uploaded) { audioUrl = uploaded.url; audioPath = uploaded.path; }
  }

  const { data, error } = await supabase
    .from("artist_posts")
    .insert({
      artist_id: artistId,
      author_id: session.userId,
      title,
      body,
      image_url: imageUrl,
      image_path: imagePath,
      audio_url: audioUrl,
      audio_path: audioPath,
      published,
    })
    .select("id, artist_id, author_id, title, body, image_url, image_path, audio_url, audio_path, published, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Map snake_case → camelCase for client
  const post = {
    id: data.id,
    artistId: data.artist_id,
    authorId: data.author_id,
    title: data.title,
    body: data.body,
    imageUrl: data.image_url,
    imagePath: data.image_path,
    audioUrl: data.audio_url,
    audioPath: data.audio_path,
    published: data.published,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };

  revalidatePath("/ru/artists");
  revalidatePath("/en/artists");
  return NextResponse.json({ ok: true, post });
}
