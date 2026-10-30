"use client";

import { useRef } from "react";
import Link from "next/link";
import { PostRichContent } from "@/components/posts/post-rich-content";
import type { Locale } from "@/lib/i18n";
import type { Post } from "@/types";
import styles from "./developer-diary-dialog.module.css";

export function DeveloperDiaryDialog({
  posts,
  locale,
  isAdmin,
}: {
  posts: Post[];
  locale: Locale;
  isAdmin: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const isRu = locale === "ru";

  return (
    <>
      <button
        className={styles.openButton}
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        {isRu ? "Дневник разработки" : "Developer diary"}
        <span aria-hidden="true">{posts.length}</span>
      </button>
      <dialog
        className={styles.dialog}
        ref={dialogRef}
        aria-labelledby="developer-diary-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            event.currentTarget.close();
          }
        }}
      >
        <div className={styles.dialogHeader}>
          <div>
            <p className={styles.eyebrow}>VST / DEV LOG</p>
            <h2 id="developer-diary-title">{isRu ? "Дневник разработки" : "Developer diary"}</h2>
          </div>
          <button
            className={styles.closeButton}
            type="button"
            aria-label={isRu ? "Закрыть дневник" : "Close diary"}
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>

        {isAdmin ? (
          <Link className={styles.manageLink} href="/admin/posts">
            {isRu ? "Добавить, изменить или удалить записи" : "Add, edit or delete entries"} <span aria-hidden="true">↗</span>
          </Link>
        ) : null}

        <div className={styles.entries}>
          {posts.length ? (
            posts.map((post) => (
              <article className={styles.entry} key={post.id}>
                <p className={styles.category}>{post.category}</p>
                <h3>{post.title}</h3>
                <time dateTime={post.createdAt}>
                  {new Date(post.createdAt).toLocaleDateString(isRu ? "ru-RU" : "en-US")}
                </time>
                <p className={styles.excerpt}>{post.excerpt}</p>
                <PostRichContent content={post.content} />
                {post.ctaLabel && post.ctaUrl ? (
                  <Link className={styles.ctaLink} href={post.ctaUrl}>
                    {post.ctaLabel} →
                  </Link>
                ) : null}
              </article>
            ))
          ) : (
            <p className={styles.emptyState}>
              {isRu ? "Записи дневника скоро появятся." : "Developer diary entries are coming soon."}
            </p>
          )}
        </div>
      </dialog>
    </>
  );
}
