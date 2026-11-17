import type { BeatStatus } from "@/types";
import { cn } from "@/lib/utils/cn";

const toneMap: Record<BeatStatus, string> = {
  available: "border-[rgba(185,149,90,0.4)] text-[var(--color-paper-200)]",
  reserved: "border-[rgba(133,149,185,0.4)] text-slate-200",
  sold: "border-red-400 bg-red-950 text-red-100 font-bold",
  private: "border-[rgba(255,255,255,0.14)] text-[var(--color-paper-400)]",
};

export function StatusBadge({ status }: { status: BeatStatus }) {
  return (
    <span
      className={cn(
        "inline-flex border px-2 py-1 text-[11px] uppercase tracking-[0.2em]",
        toneMap[status],
      )}
    >
      {status.toUpperCase()}
    </span>
  );
}