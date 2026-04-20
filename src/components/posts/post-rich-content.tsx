import Link from "next/link";
import type { ReactNode } from "react";

const imageLineRe = /^!\[(.*?)\]\((https?:\/\/[^\s)]+)\)$/i;
const fileLineRe = /^\[file:(.*?)\]\((https?:\/\/[^\s)]+)\)$/i;
const linkRe = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi;

function renderInlineLinks(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(linkRe)) {
    const label = match[1];
    const url = match[2];
    const start = match.index ?? 0;

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start));
    }

    nodes.push(
      <Link
        key={`${url}-${start}`}
        href={url}
        target="_blank"
        className="underline decoration-[var(--color-line)] underline-offset-4 hover:text-[var(--color-paper-100)]"
      >
        {label}
      </Link>,
    );

    lastIndex = start + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }

  return nodes.length ? nodes : [text];
}

export function PostRichContent({ content }: { content: string }) {
  const blocks = content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const items: ReactNode[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (!listBuffer.length) {
      return;
    }

    items.push(
      <ul key={`list-${items.length}`} className="list-disc space-y-2 pl-5 text-sm leading-7 text-[var(--color-paper-200)]">
        {listBuffer.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineLinks(item)}</li>
        ))}
      </ul>,
    );

    listBuffer = [];
  };

  blocks.forEach((line) => {
    const imageMatch = line.match(imageLineRe);
    if (imageMatch) {
      flushList();
      const [, alt, src] = imageMatch;
      items.push(
        <figure key={`${src}-${items.length}`} className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt || "Post image"} className="w-full rounded-2xl border border-[var(--color-line)] object-cover" />
          {alt ? <figcaption className="text-xs uppercase tracking-[0.16em] text-[var(--color-paper-400)]">{alt}</figcaption> : null}
        </figure>,
      );
      return;
    }

    const fileMatch = line.match(fileLineRe);
    if (fileMatch) {
      flushList();
      const [, label, href] = fileMatch;
      items.push(
        <div key={`${href}-${items.length}`}>
          <Link
            href={href}
            target="_blank"
            className="inline-flex items-center gap-2 border border-[var(--color-line)] px-4 py-2 text-sm uppercase tracking-[0.18em] text-[var(--color-paper-200)] transition-colors hover:bg-[rgba(255,255,255,0.04)]"
          >
            {label || "Download file"}
          </Link>
        </div>,
      );
      return;
    }

    if (line.startsWith("### ")) {
      flushList();
      items.push(
        <h3 key={`${line}-${items.length}`} className="font-sans text-2xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">
          {renderInlineLinks(line.slice(4))}
        </h3>,
      );
      return;
    }

    if (line.startsWith("## ")) {
      flushList();
      items.push(
        <h2 key={`${line}-${items.length}`} className="font-sans text-3xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">
          {renderInlineLinks(line.slice(3))}
        </h2>,
      );
      return;
    }

    if (line.startsWith("> ")) {
      flushList();
      items.push(
        <blockquote key={`${line}-${items.length}`} className="border-l-2 border-[var(--color-line)] pl-4 text-sm italic leading-7 text-[var(--color-paper-200)]">
          {renderInlineLinks(line.slice(2))}
        </blockquote>,
      );
      return;
    }

    if (line.startsWith("- ")) {
      listBuffer.push(line.slice(2));
      return;
    }

    flushList();
    items.push(
      <p key={`${line}-${items.length}`} className="text-sm leading-7 text-[var(--color-paper-200)]">
        {renderInlineLinks(line)}
      </p>,
    );
  });

  flushList();

  return <div className="space-y-4">{items}</div>;
}
