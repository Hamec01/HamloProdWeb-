import type { ReactNode } from "react";

type AdminCollectionTableProps = {
  title: string;
  description: string;
  columns: string[];
  rows: ReactNode[][];
};

export function AdminCollectionTable({ title, description, columns, rows }: AdminCollectionTableProps) {
  return (
    <section className="case-panel overflow-hidden">
      <div className="border-b border-[var(--color-line)] p-5">
        <h2 className="font-sans text-3xl uppercase tracking-[0.05em] text-[var(--color-paper-100)]">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-paper-200)]">{description}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-[var(--color-paper-200)]">
          <thead className="bg-[rgba(255,255,255,0.03)] text-xs uppercase tracking-[0.18em] text-[var(--color-paper-400)]">
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-5 py-4 font-medium">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`${title}-${rowIndex}`} className="border-t border-[var(--color-line)]">
                {row.map((cell, cellIndex) => (
                  <td key={`${cell}-${cellIndex}`} className="px-5 py-4">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}