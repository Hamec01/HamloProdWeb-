import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdminMutation } from "@/lib/auth/guard";
import { postFormSchema } from "@/lib/validations/post";

export const runtime = "nodejs";

function revalidatePostPages() {
  for (const p of ["/", "/ru/vst", "/en/vst", "/admin/posts"]) revalidatePath(p);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;

  const parsed = postFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid payload." }, { status: 400 });
  }

  const { id } = await params;
  const v = parsed.data;
  try {
    await prisma.post.update({
      where: { id },
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
  } catch {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  revalidatePostPages();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminMutation(request);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  await prisma.post.deleteMany({ where: { id } });

  revalidatePostPages();
  return NextResponse.json({ ok: true });
}
