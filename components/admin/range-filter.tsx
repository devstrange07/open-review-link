import Link from "next/link";
import type { OverviewRange } from "@/lib/validation";

/**
 * Date range filter.
 *
 * Plain links: they survive a refresh, can be bookmarked, and work without JS.
 */
const RANGES: Array<{ days: OverviewRange; label: string }> = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

export function RangeFilter({ active }: { active: OverviewRange }) {
  return (
    <nav aria-label="Date range" className="flex items-center gap-1">
      {RANGES.map(({ days, label }) => {
        const isActive = days === active;
        return (
          <Link
            key={days}
            href={`/admin?days=${days}`}
            aria-current={isActive ? "true" : undefined}
            className={`pressable inline-flex min-h-9 items-center rounded-lg border px-3 text-[0.8125rem] font-medium ${
              isActive
                ? "border-[color:var(--text)] bg-white text-[color:var(--text)]"
                : "border-transparent text-[color:var(--text-muted)] hover:bg-black/[0.04]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
