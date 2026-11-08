"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

/**
 * Primary/ secondary / quiet buttons.
 *
 * Deliberately not using `disabled` for in-flight states: a disabled button
 * loses focus and drops out of the accessibility tree's actionable set, which
 * is disorienting mid-request. `aria-disabled` keeps it focusable and readable
 * while the click handler no-ops.
 */

type Variant = "primary" | "secondary" | "quiet" | "success";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  loadingLabel?: string;
  fullWidth?: boolean;
  icon?: ReactNode;
};

const BASE =
  "pressable inline-flex items-center justify-center gap-2 rounded-xl px-5 text-base font-medium";

const HEIGHT = "min-h-[3.25rem]";

const VARIANTS: Record<Variant, string> = {
  primary:
    "text-[color:var(--on-brand)] bg-[color:var(--brand)] hover:bg-[color:var(--brand-ink)]",
  secondary:
    "bg-white text-[color:var(--text)] border border-[color:var(--border)] hover:border-[color:var(--text-muted)]",
  quiet: "bg-transparent text-[color:var(--brand-ink)] hover:bg-black/[0.04]",
  success: "bg-[color:var(--success)] text-white",
};

export function Button({
  variant = "primary",
  loading = false,
  loadingLabel,
  fullWidth = false,
  icon,
  children,
  className = "",
  onClick,
  ...rest
}: Props) {
  const busy = loading;

  return (
    <button
      {...rest}
      // Only reflect interactivity, not the busy state, in the DOM's disabled
      // attribute — but do prevent duplicate submits in the handler.
      aria-disabled={busy || rest["aria-disabled"] || undefined}
      aria-busy={busy || undefined}
      onClick={(event) => {
        if (busy) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={[
        BASE,
        HEIGHT,
        VARIANTS[variant],
        fullWidth ? "w-full" : "",
        // Visually dim, but still focusable so keyboard users don't lose place.
        busy ? "cursor-progress opacity-60" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {busy ? (
        <>
          <Loader2 aria-hidden="true" className="spinner size-5" />
          <span>{loadingLabel ?? "Working"}</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
