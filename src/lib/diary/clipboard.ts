export type ClipboardImage = { token: string; src: string; alt: string };

function cleanAlt(value: string) {
  return value.replace(/[\[\]\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
}

/** Convert copied rich HTML to the small Markdown subset used by the diary. */
export function diaryMarkdownFromHtml(html: string): { markdown: string; images: ClipboardImage[] } {
  const document = new DOMParser().parseFromString(html, "text/html");
  const images: ClipboardImage[] = [];

  function render(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/\s+/g, " ");
    if (!(node instanceof HTMLElement)) return "";

    const tag = node.tagName.toLowerCase();
    if (["script", "style", "noscript", "button"].includes(tag)) return "";
    if (tag === "br") return "\n";
    if (tag === "img") {
      const src = node.getAttribute("src")?.trim() ?? "";
      if (!src) return "";
      const token = `@@HPDG_PASTED_IMAGE_${images.length}@@`;
      images.push({ token, src, alt: cleanAlt(node.getAttribute("alt") || `Image ${images.length + 1}`) });
      return `\n\n${token}\n\n`;
    }

    const children = Array.from(node.childNodes).map(render).join("");
    if (tag === "a") {
      const href = node.getAttribute("href")?.trim();
      const label = children.trim();
      return href && /^https?:\/\//i.test(href) && label ? `[${label.replace(/[\[\]]/g, "")}](${href})` : label;
    }
    if (/^h[12]$/.test(tag)) return `\n\n## ${children.trim()}\n\n`;
    if (/^h[3-6]$/.test(tag)) return `\n\n### ${children.trim()}\n\n`;
    if (tag === "li") return `\n- ${children.trim()}`;
    if (tag === "blockquote") return `\n\n${children.trim().split("\n").map((line) => `> ${line}`).join("\n")}\n\n`;
    if (["p", "div", "section", "article", "figure", "figcaption", "ul", "ol"].includes(tag)) return `\n\n${children.trim()}\n\n`;
    return children;
  }

  const markdown = Array.from(document.body.childNodes)
    .map(render)
    .join("")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { markdown, images };
}

export function markdownImage(alt: string, url: string) {
  return `![${cleanAlt(alt) || "Image"}](${url})`;
}
