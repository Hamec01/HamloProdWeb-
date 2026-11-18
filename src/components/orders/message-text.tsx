export function MessageText({ text }: { text: string }) {
  return <>{text.split(/(https?:\/\/[^\s<>"]+)/gu).map((part, index) => /^https?:\/\//u.test(part) ? <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-amber-200 underline">{part}</a> : part)}</>;
}
