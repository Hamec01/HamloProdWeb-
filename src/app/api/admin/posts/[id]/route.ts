import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getAdminSessionState } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { postFormSchema } from "@/lib/validations/post";

function unauthorizedResponse(message: string, status = 401) {
  return NextResponse.json({ error: message }, { status });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) {
    return unauthorizedResponse("Supabase env is not configured.", 503);
  }

  const session = await getAdminSessionState();
  if (!session.isAuthenticated) {
    return unauthorizedResponse("Unauthorized");
  }

  const parsed = postFormSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const values = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("posts")
    .update({
      title: values.title,
      slug: values.slug,
      excerpt: values.excerpt,
      content: values.content,
      category: values.category,
      section: values.section,
      cover_palette: values.coverPalette,
      cta_label: values.ctaLabel,
      cta_url: values.ctaUrl,
      published: values.published,
      featured: values.featured,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath("/");
  revalidatePath("/ru/vst");
  revalidatePath("/en/vst");
  revalidatePath("/admin/posts");
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!hasSupabaseEnv()) {
    return unauthorizedResponse("Supabase env is not configured.", 503);
  }

  const session = await getAdminSessionState();
  if (!session.isAuthenticated) {
    return unauthorizedResponse("Unauthorized");
  }

  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("posts").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidatePath("/");
  revalidatePath("/ru/vst");
  revalidatePath("/en/vst");
  revalidatePath("/admin/posts");
  return NextResponse.json({ ok: true });
}
