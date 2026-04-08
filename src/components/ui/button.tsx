import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant = "primary" | "ghost" | "alert";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  icon?: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border border-[var(--color-line)] bg-[rgba(27,23,20,0.75)] text-[var(--color-paper-100)] hover:bg-[rgba(52,45,40,0.9)]",
  ghost:
    "border border-[var(--color-line)] bg-transparent text-[var(--color-paper-200)] hover:bg-[rgba(255,255,255,0.04)]",
  alert:
    "border border-[rgba(201,83,62,0.4)] bg-[rgba(201,83,62,0.15)] text-[var(--color-paper-100)] hover:bg-[rgba(201,83,62,0.25)]",
};

export function Button({ className, variant = "primary", icon, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 px-4 py-2 text-sm uppercase tracking-[0.18em] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}