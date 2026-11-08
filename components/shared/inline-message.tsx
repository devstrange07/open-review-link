"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

/**
 * Inline error / status messaging.
 *
 * `assertive` for errors (a customer needs to know a submit failed), `polite`
 * for confirmations (a copy succeeded; no need to interrupt).
 */

type Props = {
  tone: "error" | "success" | "info";
  children: React.ReactNode;
  assertive?: boolean;
  className?: string;
};

export function InlineMessage({
  tone,
  children,
  assertive = false,
  className = "",
}: Props) {
  const palette = {
    error: {
      bg: "var(--danger-soft)",
      border: "color-mix(in oklab, var(--danger) 25%, transparent)",
      text: "var(--danger)",
      Icon: AlertCircle,
    },
    success: {
      bg: "var(--success-soft)",
      border: "color-mix(in oklab, var(--success) 25%, transparent)",
      text: "var(--success)",
      Icon: CheckCircle2,
    },
    info: {
      bg: "var(--surface-muted)",
      border: "var(--border)",
      text: "var(--text-muted)",
      Icon: CheckCircle2,
    },
  }[tone];

  const { Icon } = palette;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={assertive || tone === "error" ? "assertive" : "polite"}
      className={[
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-snug",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        backgroundColor: palette.bg,
        borderColor: palette.border,
        color: palette.text,
      }}
    >
      <Icon aria-hidden="true" className="mt-px size-4 shrink-0" />
      <span className="text-pretty">{children}</span>
    </div>
  );
}

/**
 * Announcement-only region for outcomes that are already visible on screen
 * (a copy confirmation changing the button label, for example). Keeping this
 * separate avoids duplicating the visible message for screen reader users.
 */
export function LiveAnnouncer({ message }: { message: string }) {
  return (
    <span role="status" aria-live="polite" className="sr-only">
      {message}
    </span>
  );
}
