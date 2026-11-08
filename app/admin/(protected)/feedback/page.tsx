import type { Metadata } from "next";
import { getFeedbackPage } from "@/lib/admin-queries";
import { getAdminIdentity } from "@/lib/auth";
import { feedbackQuerySchema } from "@/lib/validation";
import { FeedbackTable } from "@/components/admin/feedback-table";

export const metadata: Metadata = { title: "Feedback" };

/**
 * Feedback history.
 *
 * Query params are validated with the same schema the API uses, so a hand-edited
 * URL can't ask for 10,000 rows or a negative page.
 */
export default async function AdminFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const auth = await getAdminIdentity();
  if (auth.status !== "authorized") return null;

  const params = await searchParams;
  const asString = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  const parsed = feedbackQuerySchema.safeParse({
    page: asString(params.page) ?? "1",
    limit: "25",
    rating: asString(params.rating) || undefined,
    from: asString(params.from) || undefined,
    to: asString(params.to) || undefined,
  });

  const filters = {
    rating: asString(params.rating) || undefined,
    from: asString(params.from) || undefined,
    to: asString(params.to) || undefined,
  };

  if (!parsed.success) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight">Feedback</h1>
        <p className="rounded-xl border border-[color:var(--border)] bg-white p-4 text-sm text-[color:var(--text-muted)]">
          Those filters aren&rsquo;t valid. Check the dates and try again.
        </p>
      </div>
    );
  }

  if (parsed.data.from && parsed.data.to && parsed.data.from > parsed.data.to) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight">Feedback</h1>
        <p className="rounded-xl border border-[color:var(--border)] bg-white p-4 text-sm text-[color:var(--text-muted)]">
          The start date is after the end date.
        </p>
      </div>
    );
  }

  let data;
  try {
    data = await getFeedbackPage(parsed.data);
  } catch {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight">Feedback</h1>
        <p className="rounded-xl border border-[color:var(--border)] bg-white p-4 text-sm text-[color:var(--text-muted)]">
          Feedback could not be loaded. Verify the database migrations have been applied,
          then refresh.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Feedback</h1>
        <p className="mt-0.5 text-[0.8125rem] text-[color:var(--text-muted)]">
          Only feedback a customer chose to share privately. No names or contact details
          are collected.
        </p>
      </div>

      <FeedbackTable data={data} filters={filters} />
    </div>
  );
}
