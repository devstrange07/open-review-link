import type { Metadata } from "next";
import { getAdminIdentity } from "@/lib/auth";
import { getOverview } from "@/lib/admin-queries";
import { overviewQuerySchema } from "@/lib/validation";
import { MetricCard } from "@/components/admin/dashboard-metric-card";
import { RatingDistributionChart } from "@/components/admin/rating-distribution-chart";
import { RangeFilter } from "@/components/admin/range-filter";

export const metadata: Metadata = { title: "Overview" };

/**
 * Dashboard overview.
 *
 * Reads metrics server-side so the numbers are in the HTML on first paint —
 * no skeleton flash, and the values are consistent because they come from a
 * single RPC snapshot.
 */
export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsed = overviewQuerySchema.safeParse({ days: params.days ?? undefined });
  const range = parsed.success ? parsed.data.days : 30;

  // The layout already gated access; this is for the type narrowing only.
  const auth = await getAdminIdentity();
  if (auth.status !== "authorized") return null;

  let overview;
  try {
    overview = await getOverview(range);
  } catch {
    return (
      <div className="rounded-xl border border-[color:var(--border)] bg-white p-6">
        <h1 className="text-lg font-semibold tracking-tight">Metrics unavailable</h1>
        <p className="mt-1.5 text-sm text-[color:var(--text-muted)]">
          The dashboard could not load its data. Verify the database migrations have been
          applied, then refresh.
        </p>
      </div>
    );
  }

  const average =
    overview.averageRating === null ? "—" : overview.averageRating.toFixed(2);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-0.5 text-[0.8125rem] text-[color:var(--text-muted)]">
            Last {range} days
          </p>
        </div>
        <RangeFilter active={range} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          label="Feedback submissions"
          value={overview.totalFeedback}
          hint="Only customers who consented to private sharing"
        />
        <MetricCard
          label="Average rating"
          value={
            <span className="inline-flex items-baseline gap-1">
              {average}
              <span className="text-sm font-normal text-[color:var(--text-muted)]">
                / 5
              </span>
            </span>
          }
        />
        <MetricCard label="Five-star ratings" value={overview.fiveStarCount} />
        <MetricCard
          label="AI drafts generated"
          value={overview.aiGenerationSucceeded}
          hint={
            overview.aiGenerationFailed > 0
              ? `${overview.aiGenerationFailed} failed`
              : undefined
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <RatingDistributionChart
          distribution={overview.ratingDistribution}
          total={overview.totalFeedback}
        />

        <div className="space-y-3">
          <MetricCard
            label="Google review link clicks"
            value={overview.googleReviewClicked}
            hint="Outbound clicks only. This is not a count of published reviews."
          />
          <MetricCard
            label="Reviews copied"
            value={overview.reviewCopied}
            hint="Confirmed clipboard writes"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Page opens" value={overview.pageOpened} muted />
        <MetricCard label="Ratings selected" value={overview.ratingSelected} muted />
        <MetricCard label="Feedback saved events" value={overview.feedbackSaved} muted />
        <MetricCard label="AI failures" value={overview.aiGenerationFailed} muted />
      </div>
    </div>
  );
}
