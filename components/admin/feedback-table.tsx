import Link from "next/link";
import { Star, Inbox, ChevronLeft, ChevronRight } from "lucide-react";
import type { FeedbackPage } from "@/lib/admin-queries";

/**
 * Feedback history.
 *
 * A real <table> with proper header cells — this is tabular data, and a grid of
 * divs would cost screen reader users the row/column relationships. Filters and
 * pagination are links so the view is refreshable and shareable.
 */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildHref(
  base: Record<string, string | undefined>,
  overrides: Record<string, string | undefined>,
): string {
  const params = new URLSearchParams();
  const merged = { ...base, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `/admin/feedback?${query}` : "/admin/feedback";
}

const RATING_FILTERS = [
  { value: undefined, label: "All" },
  { value: "5", label: "5" },
  { value: "4", label: "4" },
  { value: "3", label: "3" },
  { value: "2", label: "2" },
  { value: "1", label: "1" },
] as const;

export function FeedbackTable({
  data,
  filters,
}: {
  data: FeedbackPage;
  filters: { rating?: string; from?: string; to?: string };
}) {
  const base = {
    rating: filters.rating,
    from: filters.from,
    to: filters.to,
  };

  return (
    <div className="space-y-4">
      <form
        method="GET"
        action="/admin/feedback"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-[color:var(--border)] bg-white p-3"
      >
        <div>
          <label
            htmlFor="from"
            className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]"
          >
            From
          </label>
          <input
            id="from"
            name="from"
            type="date"
            defaultValue={filters.from ?? ""}
            className="field !w-auto !py-2 !text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="to"
            className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]"
          >
            To
          </label>
          <input
            id="to"
            name="to"
            type="date"
            defaultValue={filters.to ?? ""}
            className="field !w-auto !py-2 !text-sm"
          />
        </div>
        {filters.rating ? (
          <input type="hidden" name="rating" value={filters.rating} />
        ) : null}
        <button
          type="submit"
          className="pressable inline-flex min-h-9 items-center rounded-lg border border-[color:var(--border)] bg-white px-3 text-[0.8125rem] font-medium"
        >
          Apply dates
        </button>
        {filters.from || filters.to ? (
          <Link
            href={buildHref({ rating: filters.rating }, {})}
            className="pressable inline-flex min-h-9 items-center rounded-lg px-2 text-[0.8125rem] font-medium text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
          >
            Clear dates
          </Link>
        ) : null}
      </form>

      <nav aria-label="Filter by rating" className="flex items-center gap-1">
        <span className="mr-1 text-xs font-medium text-[color:var(--text-muted)]">
          Rating
        </span>
        {RATING_FILTERS.map(({ value, label }) => {
          const isActive = (filters.rating ?? undefined) === value;
          return (
            <Link
              key={label}
              href={buildHref(base, { rating: value, page: undefined })}
              aria-current={isActive ? "true" : undefined}
              className={`pressable inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border px-2.5 text-[0.8125rem] font-medium ${
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

      {data.rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-[color:var(--border)] bg-white px-6 py-14 text-center">
          <Inbox aria-hidden="true" className="size-7 text-[color:var(--text-muted)]" />
          <p className="mt-3 text-sm font-medium">No feedback here</p>
          <p className="mt-1 max-w-xs text-[0.8125rem] leading-relaxed text-pretty text-[color:var(--text-muted)]">
            {filters.rating || filters.from || filters.to
              ? "Nothing matches these filters. Try widening the date range or clearing the rating filter."
              : "Feedback appears here once a customer consents to share it privately."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[color:var(--border)] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <caption className="sr-only">
                Private feedback shared with the shop, newest first
              </caption>
              <thead>
                <tr className="border-b border-[color:var(--border)] text-left">
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-xs font-medium text-[color:var(--text-muted)]"
                  >
                    Date
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-xs font-medium text-[color:var(--text-muted)]"
                  >
                    Rating
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-xs font-medium text-[color:var(--text-muted)]"
                  >
                    Feedback
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-xs font-medium text-[color:var(--text-muted)]"
                  >
                    Reference
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-xs font-medium text-[color:var(--text-muted)]"
                  >
                    Follow-up
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2.5 text-xs font-medium text-[color:var(--text-muted)]"
                  >
                    Notice
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-[color:var(--border)] last:border-0"
                  >
                    <td className="px-4 py-3 align-top text-[0.8125rem] whitespace-nowrap text-[color:var(--text-muted)]">
                      {formatDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span
                        className="inline-flex items-center gap-0.5"
                        aria-label={`${row.rating} out of 5`}
                      >
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            aria-hidden="true"
                            className="size-3.5"
                            style={{
                              color:
                                star <= row.rating ? "var(--brand)" : "var(--border)",
                              fill: star <= row.rating ? "var(--brand)" : "transparent",
                            }}
                          />
                        ))}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      {row.improvementTopics.length > 0 ? (
                        <ul className="mb-2 flex flex-wrap gap-1">
                          {row.improvementTopics.map((topic) => (
                            <li
                              key={topic}
                              className="rounded-md bg-[color:var(--brand-soft)] px-1.5 py-0.5 text-[0.6875rem] text-[color:var(--brand-ink)]"
                            >
                              {topic.replaceAll("_", " ")}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      <p className="max-w-prose leading-relaxed text-pretty whitespace-pre-line">
                        {row.feedbackText ?? (
                          <span className="text-[color:var(--text-muted)]">
                            No text provided
                          </span>
                        )}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top font-mono text-xs text-[color:var(--text-muted)]">
                      {row.publicReference}
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-[color:var(--text-muted)]">
                      {row.followUpConsent ? (
                        <span className="text-[color:var(--text)]">
                          {row.contactPhone ?? "Requested"}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-xs whitespace-nowrap text-[color:var(--text-muted)]">
                      {row.consentNoticeVersion}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {data.total > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="tabular text-[0.8125rem] text-[color:var(--text-muted)]">
            Showing {(data.page - 1) * data.limit + 1}–
            {Math.min(data.page * data.limit, data.total)} of {data.total}
          </p>

          {data.totalPages > 1 ? (
            <nav aria-label="Pagination" className="flex items-center gap-1">
              <PageLink
                href={buildHref(base, {
                  page: data.page > 2 ? String(data.page - 1) : undefined,
                })}
                disabled={data.page <= 1}
                label="Previous page"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
              </PageLink>

              <span className="tabular px-2 text-[0.8125rem] text-[color:var(--text-muted)]">
                {data.page} / {data.totalPages}
              </span>

              <PageLink
                href={buildHref(base, {
                  page: data.page < data.totalPages ? String(data.page + 1) : undefined,
                })}
                disabled={data.page >= data.totalPages}
                label="Next page"
              >
                <ChevronRight aria-hidden="true" className="size-4" />
              </PageLink>
            </nav>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PageLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className="inline-flex size-9 items-center justify-center rounded-lg text-[color:var(--border)]"
      >
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className="pressable inline-flex size-9 items-center justify-center rounded-lg border border-[color:var(--border)] bg-white text-[color:var(--text-muted)] hover:text-[color:var(--text)]"
    >
      {children}
    </Link>
  );
}
