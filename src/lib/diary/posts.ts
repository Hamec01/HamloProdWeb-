import { prisma } from "@/lib/db/client";
import { localizePosts } from "@/lib/localize-content";
import { rewriteLegacyPublicStorageUrls } from "@/lib/storage/public-url";
import type { Locale } from "@/lib/i18n";
import type { Post } from "@/types";

/** Only VST diary entries. Drafts and original editable text stay admin-only. */
export async function getDiaryPosts(locale: Locale, canEdit = false): Promise<Post[]> {
  const rows = await prisma.post.findMany({
    where: { section: "vst", ...(canEdit ? {} : { published: true }) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  const posts: Post[] = rows.map((row) => ({
    ...row, section: "vst", content: canEdit ? row.content : rewriteLegacyPublicStorageUrls(row.content),
    createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  }));
  return canEdit ? posts : localizePosts(posts, locale);
}

export function diaryPostFields(input: { title: string; content: string; published: boolean }) {
  return {
    title: input.title, content: input.content, published: input.published,
    excerpt: input.content.replace(/[#>*\[\]]/g, "").replace(/\s+/g, " ").slice(0, 180),
    section: "vst", category: "devlog", featured: false,
  };
}
