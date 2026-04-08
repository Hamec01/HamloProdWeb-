export function PublicFooter() {
  return (
    <footer className="border-t border-[var(--color-line)] px-6 py-8 text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>Archive / Case Files</span>
        <span>Public content is read-only. Creation flows belong to admin.</span>
      </div>
    </footer>
  );
}