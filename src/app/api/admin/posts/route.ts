import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminMutation } from "@/lib/auth/guard";
import { postFormSchema } from "@/lib/validations/post";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;

  const parsed = postFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const v = parsed.data;
  try {
    await prisma.post.create({
      data: {
        title: v.title,
        slug: v.slug,
        excerpt: v.excerpt,
        content: v.content,
        category: v.category,
        section: v.section,
        coverPalette: v.coverPalette,
        ctaLabel: v.ctaLabel,
        ctaUrl: v.ctaUrl,
        published: v.published,
        featured: v.featured,
      },
    });
  } catch (error) {
    const message = error instanceof Error && /Unique constraint/.test(error.message) ? "A post with this slug already exists." : "Failed to create post.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  for (const p of ["/", "/ru/vst", "/en/vst", "/admin/posts"]) revalidatePath(p);
  return NextResponse.json({ ok: true });
}
