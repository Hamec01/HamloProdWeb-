"use client";

import { useId, useRef, useState, type ClipboardEvent, type FormEvent } from "react";
import Link from "next/link";
import { PostRichContent } from "@/components/posts/post-rich-content";
import { diaryMarkdownFromHtml, markdownImage } from "@/lib/diary/clipboard";
import type { Locale } from "@/lib/i18n";
import { uploadAdminAsset } from "@/lib/storage/client-upload";
import type { Post } from "@/types";
import styles from "./developer-diary-dialog.module.css";

type Editor = { id: string | null; assetOwnerId: string; updatedAt?: string; title: string; content: string; published: boolean };

const imageExtension: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

export function DeveloperDiaryDialog({ posts, locale, isAdmin }: { posts: Post[]; locale: Locale; isAdmin: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const titleId = useId();
  const [entries, setEntries] = useState(posts);
  const [canEdit, setCanEdit] = useState(isAdmin);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [preview, setPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const isRu = locale === "ru";
  const t = (ru: string, en: string) => isRu ? ru : en;

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch(`/api/vst/diary?locale=${locale}`, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? t("Не удалось загрузить дневник.", "Could not load the diary."));
      setEntries(data.posts); setCanEdit(data.canEdit);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Ошибка соединения. Попробуй ещё раз.", "Connection error. Try again."));
    } finally { setLoading(false); }
  }

  function edit(post?: Post) {
    setError(""); setNotice(""); setPreview(false);
    setEditor(post ? { id: post.id, assetOwnerId: post.id, updatedAt: post.updatedAt, title: post.title, content: post.content, published: post.published } : { id: null, assetOwnerId: crypto.randomUUID(), title: "", content: "", published: true });
    requestAnimationFrame(() => { bodyRef.current?.scrollTo({ top: 0 }); titleRef.current?.focus(); });
  }

  function insertAtCursor(snippet: string) {
    if (!editor) return;
    const textarea = contentRef.current;
    const start = textarea?.selectionStart ?? editor.content.length;
    const end = textarea?.selectionEnd ?? editor.content.length;
    setEditor((current) => current ? { ...current, content: `${current.content.slice(0, start)}${snippet}${current.content.slice(end)}` } : current);
    requestAnimationFrame(() => { textarea?.focus(); textarea?.setSelectionRange(start + snippet.length, start + snippet.length); });
  }

  async function uploadFile(file: File) {
    if (!editor) throw new Error(t("Сначала открой редактор.", "Open the editor first."));
    const type = file.type.toLowerCase();
    if (!imageExtension[type]) throw new Error(t("Поддерживаются JPG, PNG и WebP.", "JPG, PNG and WebP are supported."));
    return (await uploadAdminAsset("post-file", editor.assetOwnerId, file)).publicUrl;
  }

  async function importImage(src: string, alt: string, index: number, clipboardFile?: File) {
    if (clipboardFile) {
      const url = await uploadFile(clipboardFile);
      if (url) return markdownImage(alt || clipboardFile.name, url);
    }
    try {
      const response = await fetch(src, { credentials: "omit" });
      if (!response.ok) throw new Error("Image download failed.");
      const blob = await response.blob();
      const extension = imageExtension[blob.type.toLowerCase()];
      if (!extension) throw new Error("Unsupported image.");
      const url = await uploadFile(new File([blob], `pasted-${index + 1}.${extension}`, { type: blob.type }));
      if (url) return markdownImage(alt, url);
    } catch {
      // Cross-origin images often cannot be read by the browser. Import them on
      // the server, where private/local addresses are rejected and DNS is pinned.
    }
    if (!/^https:\/\//i.test(src)) throw new Error(t("Одну из картинок нельзя прочитать из буфера. Сохрани её и добавь кнопкой ниже.", "One pasted image could not be read. Save it and use the image button below."));
    const response = await fetch("/api/admin/vst/diary/image-import", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: src, ownerId: editor?.assetOwnerId }),
    });
    const data = await response.json().catch(() => null) as { publicUrl?: string; error?: string } | null;
    if (!response.ok || !data?.publicUrl) throw new Error(data?.error ?? t("Не удалось сохранить картинку из буфера.", "Could not save a pasted image."));
    return markdownImage(alt, data.publicUrl);
  }

  async function pasteRich(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!editor || busy) return;
    const html = event.clipboardData.getData("text/html");
    if (!html) return;
    const parsed = diaryMarkdownFromHtml(html);
    if (!parsed.images.length) return;
    event.preventDefault();
    if (parsed.images.length > 12) { setError(t("За один раз можно вставить не больше 12 картинок.", "Paste no more than 12 images at a time.")); return; }
    setBusy(true); setError(""); setNotice(t(`Сохраняю картинки: 0/${parsed.images.length}…`, `Saving images: 0/${parsed.images.length}…`));
    try {
      const files = Array.from(event.clipboardData.items).map((item) => item.kind === "file" ? item.getAsFile() : null).filter((file): file is File => Boolean(file?.type.startsWith("image/")));
      let markdown = parsed.markdown;
      for (let index = 0; index < parsed.images.length; index += 1) {
        const image = parsed.images[index];
        const snippet = await importImage(image.src, image.alt, index, files.length === parsed.images.length ? files[index] : undefined);
        markdown = markdown.replace(image.token, snippet);
        setNotice(t(`Сохраняю картинки: ${index + 1}/${parsed.images.length}…`, `Saving images: ${index + 1}/${parsed.images.length}…`));
      }
      if (markdown.length + editor.content.length > 30_000) throw new Error(t("Запись получилась слишком длинной.", "The entry is too long."));

      const blocks = markdown.split(/\n{2,}/);
      const first = blocks[0]?.replace(/^#{2,3}\s+/, "").trim() ?? "";
      if (!editor.title.trim() && !editor.content.trim() && blocks.length > 1 && first.length >= 2 && first.length <= 200 && !first.startsWith("![")) {
        setEditor({ ...editor, title: first, content: blocks.slice(1).join("\n\n") });
        requestAnimationFrame(() => contentRef.current?.focus());
      } else {
        insertAtCursor(markdown);
      }
      setNotice(t(`Вставлено: текст и ${parsed.images.length} картинок. Они сохранены на сайте.`, `Inserted text and ${parsed.images.length} images. They are stored on the site.`));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("Не удалось вставить материал. Буфер обмена не изменён.", "Could not paste the material. Your clipboard is unchanged."));
      setNotice("");
    } finally { setBusy(false); }
  }

  async function addImageFiles(files: FileList | null) {
    if (!files?.length || !editor || busy) return;
    setBusy(true); setError(""); setNotice(t("Загружаю картинки…", "Uploading images…"));
    try {
      const snippets: string[] = [];
      for (const file of Array.from(files).slice(0, 12)) {
        const url = await uploadFile(file);
        if (url) snippets.push(markdownImage(file.name.replace(/\.[^.]+$/, ""), url));
      }
      insertAtCursor(`\n\n${snippets.join("\n\n")}\n\n`);
      setNotice(t(`Добавлено картинок: ${snippets.length}.`, `Images added: ${snippets.length}.`));
    } catch (e) { setError(e instanceof Error ? e.message : t("Не удалось загрузить картинки.", "Could not upload the images.")); setNotice(""); }
    finally { setBusy(false); }
  }

  async function mutate(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method, credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) throw new Error(t("Сессия закончилась. Войди как администратор; текст остался в редакторе.", "Your session expired. Sign in as admin; your text is still in the editor."));
      throw new Error(data?.error ?? t("Не удалось сохранить запись.", "Could not save the entry."));
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const { id, updatedAt } = editor;
      const fields = { title: editor.title, content: editor.content, published: editor.published };
      await mutate(id ? `/api/admin/vst/diary/${id}` : "/api/admin/vst/diary", id ? "PUT" : "POST", id ? { ...fields, updatedAt } : fields);
      setEditor(null); setPreview(false);
      setNotice(fields.published ? t("Запись опубликована в дневнике.", "Entry published in the diary.") : t("Черновик сохранён. Посетителям он не виден.", "Draft saved. Visitors cannot see it."));
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : t("Ошибка соединения. Текст сохранён в редакторе.", "Connection error. Your text is still in the editor.")); }
    finally { setBusy(false); }
  }

  async function remove(post: Post) {
    if (busy || !window.confirm(t(`Удалить запись «${post.title}»?`, `Delete “${post.title}”?`))) return;
    setBusy(true); setError(""); setNotice("");
    try {
      await mutate(`/api/admin/vst/diary/${post.id}`, "DELETE");
      if (editor?.id === post.id) setEditor(null);
      setNotice(t("Запись удалена.", "Entry deleted."));
      await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : t("Не удалось удалить запись.", "Could not delete the entry.")); }
    finally { setBusy(false); }
  }

  return (
    <>
      <button className={styles.openButton} type="button" onClick={() => { dialogRef.current?.showModal(); setError(""); void refresh(); }}>
        {t("Дневник разработки", "Developer diary")}
        <span aria-hidden="true">{entries.filter((post) => post.published).length}</span>
      </button>
      <dialog className={styles.dialog} ref={dialogRef} aria-labelledby={titleId} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        <div className={styles.dialogHeader}>
          <div><p className={styles.eyebrow}>VST / DEV LOG</p><h2 id={titleId}>{t("Дневник разработки", "Developer diary")}</h2></div>
          <button className={styles.closeButton} type="button" aria-label={t("Закрыть дневник", "Close diary")} onClick={() => dialogRef.current?.close()}>×</button>
        </div>
        <div className={styles.body} ref={bodyRef}>
          <div className={styles.toolbar}>
            {canEdit ? <button className={styles.primaryButton} type="button" disabled={busy || loading || editor !== null} onClick={() => edit()}>{t("+ Новая запись", "+ New entry")}</button> : null}
            <button className={styles.textButton} type="button" disabled={busy || loading} onClick={() => { setError(""); void refresh(); }}>{loading ? t("Загружаю…", "Loading…") : t("Обновить", "Refresh")}</button>
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
          {canEdit && editor ? (
            <form className={styles.editor} onSubmit={save} aria-label={t("Редактор дневника", "Diary editor")}>
              <h3>{editor.id ? t("Редактировать запись", "Edit entry") : t("Новая запись", "New entry")}</h3>
              <label><span>{t("Заголовок", "Title")}</span><input ref={titleRef} autoComplete="off" required minLength={2} maxLength={200} value={editor.title} disabled={busy} onChange={(e) => setEditor({ ...editor, title: e.target.value })} /></label>
              <div className={styles.formatToolbar}>
                <button type="button" disabled={busy} onClick={() => insertAtCursor("\n## Заголовок\n")}>H2</button>
                <button type="button" disabled={busy} onClick={() => insertAtCursor("\n### Подзаголовок\n")}>H3</button>
                <button type="button" disabled={busy} onClick={() => insertAtCursor("\n- Пункт 1\n- Пункт 2\n")}>{t("Список", "List")}</button>
                <button type="button" disabled={busy} onClick={() => insertAtCursor("\n> Цитата\n")}>{t("Цитата", "Quote")}</button>
                <button type="button" disabled={busy} onClick={() => { const label = window.prompt(t("Текст ссылки", "Link text")); const url = window.prompt("URL", "https://"); if (label && url) insertAtCursor(`[${label}](${url})`); }}>{t("Ссылка", "Link")}</button>
              </div>
              <label><span>{t("Текст записи", "Entry text")}</span><textarea ref={contentRef} required maxLength={30000} rows={12} value={editor.content} disabled={busy} onPaste={(event) => void pasteRich(event)} onChange={(e) => setEditor({ ...editor, content: e.target.value })} /></label>
              <label className={styles.filePicker}><span>{t("Добавить картинки", "Add images")}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(event) => { void addImageFiles(event.currentTarget.files); event.currentTarget.value = ""; }} /></label>
              <p className={styles.hint}>{t("Можно скопировать готовый текст вместе с картинками и вставить сюда. Первая строка станет заголовком, если поле заголовка пустое. Картинки будут сохранены на сайте. Также доступны ## заголовки, - списки и ссылки.", "Copy finished text together with its images and paste it here. The first line becomes the title when the title field is empty. Images are stored on the site. ## headings, - lists and links are also supported.")}</p>
              <label className={styles.checkbox}><input type="checkbox" checked={editor.published} disabled={busy} onChange={(e) => setEditor({ ...editor, published: e.target.checked })} /><span>{t("Опубликовать — запись увидят посетители", "Publish — visitors will see this entry")}</span></label>
              <div className={styles.actions}>
                <button className={styles.primaryButton} type="submit" disabled={busy || loading || editor.title.trim().length < 2 || !editor.content.trim()}>{busy ? t("Сохраняю…", "Saving…") : editor.published ? t("Опубликовать", "Publish") : t("Сохранить черновик", "Save draft")}</button>
                <button className={styles.textButton} type="button" aria-expanded={preview} disabled={busy} onClick={() => setPreview(!preview)}>{t("Предпросмотр", "Preview")}</button>
                <button className={styles.textButton} type="button" disabled={busy} onClick={() => { setEditor(null); setPreview(false); }}>{t("Отмена", "Cancel")}</button>
              </div>
              {preview ? <div className={styles.preview}><h3>{editor.title}</h3><PostRichContent content={editor.content} /></div> : null}
            </form>
          ) : null}
          <div className={styles.entries} aria-busy={loading}>
            {entries.length ? entries.map((post) => (
              <article className={styles.entry} key={post.id}>
                <div className={styles.entryMeta}><span className={styles.category}>{post.published ? "DEV LOG" : t("Черновик · виден только администрации", "Draft · admin only")}</span>
                  <time dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString(isRu ? "ru-RU" : "en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Helsinki" })}</time>
                </div>
                <h3>{post.title}</h3>
                <PostRichContent content={post.content} />
                {post.ctaLabel && post.ctaUrl ? <Link className={styles.ctaLink} href={post.ctaUrl} target="_blank" rel="noreferrer">{post.ctaLabel} →</Link> : null}
                {canEdit ? <div className={styles.actions}><button className={styles.textButton} type="button" disabled={busy} onClick={() => edit(post)}>{t("Редактировать", "Edit")}</button><button className={styles.deleteButton} type="button" disabled={busy} onClick={() => void remove(post)}>{t("Удалить", "Delete")}</button></div> : null}
              </article>
            )) : <p className={styles.emptyState}>{t("Записи дневника скоро появятся.", "Developer diary entries are coming soon.")}</p>}
          </div>
        </div>
      </dialog>
    </>
  );
}
