import { ExternalLink } from "lucide-react";

/**
 * Google review link.
 *
 * Rendered identically on every screen and for every rating, including 1 star.
 * No rating-based routing, no conditional styling, no "thanks for the 5 stars,
 * here's Google" branch — the spec forbids it and it would be dishonest.
 *
 * A plain <a> so it works with middle-click, long-press, and reader mode, and
 * so no JavaScript is required to reach Google.
 */

type Props = {
  href: string;
  label?: string;
  variant?: "link" | "block";
  onNavigate?: () => void;
};

export function GoogleReviewLink({
  href,
  label = "Review us on Google",
  variant = "link",
  onNavigate,
}: Props) {
  const common = {
    href,
    target: "_blank",
    rel: "noopener noreferrer",
    onClick: onNavigate,
  } as const;

  if (variant === "link") {
    return (
      <a
        {...common}
        className="pressable inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-[color:var(--brand-ink)] underline-offset-4 hover:underline"
      >
        {label}
        <ExternalLink aria-hidden="true" className="size-3.5" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }

  return (
    <a
      {...common}
      className="pressable flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-white px-5 text-base font-medium text-[color:var(--text)] hover:border-[color:var(--text-muted)]"
    >
      {label}
      <ExternalLink aria-hidden="true" className="size-4" />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  );
}
