type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

export function SectionHeading({ eyebrow, title, description }: SectionHeadingProps) {
  return (
    <div className="space-y-3">
      {eyebrow ? <p className="text-xs uppercase tracking-[0.32em] text-[var(--color-paper-400)]">{eyebrow}</p> : null}
      <h2 className="font-sans text-4xl uppercase tracking-[0.08em] text-[var(--color-paper-100)] sm:text-5xl">
        {title}
      </h2>
      {description ? <p className="max-w-2xl text-sm leading-7 text-[var(--color-paper-200)]">{description}</p> : null}
    </div>
  );
}