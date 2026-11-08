import type { ReactNode } from "react";

/**
 * Metric card. Server component — these numbers are static per request, so
 * shipping JS for them would be waste.
 */
export function MetricCard({
  label,
  value,
  hint,
  muted = false,
  valueClassName = "",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  muted?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-white p-4">
      <p className="text-[0.8125rem] leading-snug font-medium text-[color:var(--text-muted)]">
        {label}
      </p>
      <p
        className={[
          "tabular mt-2 text-2xl font-semibold tracking-tight",
          muted ? "text-[color:var(--text-muted)]" : "",
          valueClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-pretty text-[color:var(--text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
