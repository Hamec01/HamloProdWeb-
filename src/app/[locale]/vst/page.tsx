import { AdminPostCrudManager } from "@/components/admin/admin-post-crud-manager";
import Link from "next/link";
import { PostRichContent } from "@/components/posts/post-rich-content";
import { SectionHeading } from "@/components/ui/section-heading";
import { getAdminSessionState } from "@/lib/auth/session";
import { localizePosts } from "@/lib/localize-content";
import { normalizeLocale, sectorLabels } from "@/lib/market";
import { getAdminPosts, getPosts } from "@/services/content";

export default async function SectorVstPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const [vstPosts, adminSession] = await Promise.all([getPosts("vst"), getAdminSessionState()]);
  const posts = await localizePosts(vstPosts, locale);
  const adminPosts = adminSession.isAuthenticated
    ? (await getAdminPosts()).filter((post) => post.section === "vst")
    : [];

  return (
    <section className="space-y-8">
      <SectionHeading
        eyebrow={sectorLabels[locale].vst}
        title="Drum Generator VST"
        description={
          locale === "ru"
            ? "Теперь этот сектор можно наполнять новостями и анонсами прямо из admin-панели."
            : "This sector can now be filled with news and announcements directly from the admin panel."
        }
      />

      <article className="case-panel p-6">
        <p className="text-sm leading-7 text-[var(--color-paper-200)]">
          {locale === "ru"
            ? "Публикуй посты на русском в админке — при переключении на EN текст будет подтягиваться в автопереводе."
            : "Publish posts in Russian from the admin panel — the EN view will auto-translate them."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
          >
            {locale === "ru" ? "На главную" : "Back home"}
          </Link>
          <Link
            href="/admin/posts"
            className="inline-flex items-center gap-2 border border-[rgba(185,149,90,0.42)] bg-[rgba(185,149,90,0.12)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)]"
          >
            {locale === "ru" ? "Открыть CMS" : "Open CMS"}
          </Link>
        </div>
      </article>

      <div className="grid gap-6">
        {posts.length ? (
          posts.map((post) => (
            <article key={post.id} className="case-panel overflow-hidden p-6">
              <div className={`h-2 w-full bg-gradient-to-r ${post.coverPalette}`} />
              <div className="mt-5 flex flex-wrap items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-[var(--color-paper-400)]">
                <span>{post.category}</span>
                <span>•</span>
                <span>{post.featured ? (locale === "ru" ? "Рекомендуем" : "Featured") : post.section}</span>
              </div>
              <h2 className="mt-3 font-sans text-4xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">
                {post.title}
              </h2>
              <p className="mt-4 max-w-4xl text-base leading-7 text-[var(--color-paper-200)]">{post.excerpt}</p>
              <div className="mt-5">
                <PostRichContent content={post.content} />
              </div>
              {post.ctaLabel ? (
                <div className="mt-6">
                  {post.ctaUrl ? (
                    <Link
                      href={post.ctaUrl}
                      className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
                    >
                      {post.ctaLabel}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-2 border border-[rgba(185,149,90,0.42)] bg-[rgba(185,149,90,0.12)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-100)]">
                      {post.ctaLabel}
                    </span>
                  )}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <article className="case-panel p-6 text-sm leading-7 text-[var(--color-paper-200)]">
            {locale === "ru"
              ? "Постов пока нет. Создай первый материал в admin → Posts / News."
              : "No posts yet. Create the first entry in admin → Posts / News."}
          </article>
        )}
      </div>

      {adminSession.isAuthenticated ? (
        <section className="space-y-4">
          <p className="text-xs uppercase tracking-[0.24em] text-[var(--color-paper-400)]">
            {locale === "ru" ? "Управление VST-постами (admin)" : "VST Post Management (admin)"}
          </p>
          <AdminPostCrudManager posts={adminPosts} hasSupabase={adminSession.hasSupabase} />
        </section>
      ) : null}
    </section>
  );
}
