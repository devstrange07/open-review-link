import { Star } from "lucide-react";

/**
 * Rating distribution.
 *
 * CSS bars rather than a charting library: recharts would add ~100KB to the
 * admin bundle to draw five rectangles, and the bars need to read correctly in
 * a table-adjacent context anyway.
 *
 * Each row is labelled with its count, so the bar is redundant information
 * rather than the only way to read the value — required for screen readers and
 * for anyone who can't distinguish the bar lengths.
 */
export function RatingDistributionChart({
  distribution,
  total,
}: {
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  total: number;
}) {
  const max = Math.max(1, ...Object.values(distribution));

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-white p-4">
      <h2 className="text-sm font-semibold tracking-tight">Rating distribution</h2>

      {total === 0 ? (
        <p className="mt-3 text-sm text-[color:var(--text-muted)]">
          No ratings in this period yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {([5, 4, 3, 2, 1] as const).map((rating) => {
            const count = distribution[String(rating) as "1"];
            const percent = total > 0 ? Math.round((count / total) * 100) : 0;
            const width = count === 0 ? 0 : Math.max(2, (count / max) * 100);

            return (
              <li key={rating} className="flex items-center gap-2.5">
                <span className="tabular flex w-12 shrink-0 items-center gap-0.5 text-xs text-[color:var(--text-muted)]">
                  {rating}
                  <Star aria-hidden="true" className="size-3 fill-current" />
                </span>

                <span
                  aria-hidden="true"
                  className="h-2.5 flex-1 overflow-hidden rounded-full bg-[color:var(--surface-muted)]"
                >
                  <span
                    className="block h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${width}%`,
                      backgroundColor: "var(--brand)",
                    }}
                  />
                </span>

                <span className="tabular w-16 shrink-0 text-right text-xs text-[color:var(--text-muted)]">
                  {count} · {percent}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
