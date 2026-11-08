import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { OverviewRange } from "@/lib/validation";

/**
 * Dashboard queries.
 *
 * All reads go through the service-role client, but every caller has already
 * passed `requireAdmin()`. The RPC functions are granted to `service_role` only,
 * so there is no path to this data from a browser session even with a valid
 * Supabase login that happens to be missing from `admin_users`.
 */

export type OverviewData = {
  rangeDays: OverviewRange;
  from: string;
  to: string;
  totalFeedback: number;
  averageRating: number | null;
  fiveStarCount: number;
  ratingDistribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  aiGenerationSucceeded: number;
  aiGenerationFailed: number;
  reviewCopied: number;
  googleReviewClicked: number;
  feedbackSaved: number;
  pageOpened: number;
  ratingSelected: number;
};

type OverviewRpcResult = {
  totalFeedback: number;
  averageRating: number | string | null;
  fiveStarCount: number;
  ratingDistribution: Record<string, number>;
  events: Record<string, number> | null;
  range: { from: string; to: string };
};

export async function getOverview(rangeDays: OverviewRange): Promise<OverviewData> {
  const to = new Date();
  const from = new Date(to.getTime() - rangeDays * 24 * 60 * 60 * 1000);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .rpc("get_admin_overview", {
      p_from: from.toISOString(),
      p_to: to.toISOString(),
    })
    .single<OverviewRpcResult>();

  if (error || !data) {
    console.error("[admin] overview rpc failed", error?.code ?? "no data");
    throw new Error("Could not load dashboard metrics.");
  }

  const events = data.events ?? {};
  const distribution = data.ratingDistribution ?? {};

  return {
    rangeDays,
    from: data.range.from,
    to: data.range.to,
    totalFeedback: Number(data.totalFeedback ?? 0),
    // Postgres returns numeric as a string to avoid precision loss.
    averageRating:
      data.averageRating === null || data.averageRating === undefined
        ? null
        : Number(data.averageRating),
    fiveStarCount: Number(data.fiveStarCount ?? 0),
    ratingDistribution: {
      "1": Number(distribution["1"] ?? 0),
      "2": Number(distribution["2"] ?? 0),
      "3": Number(distribution["3"] ?? 0),
      "4": Number(distribution["4"] ?? 0),
      "5": Number(distribution["5"] ?? 0),
    },
    aiGenerationSucceeded: Number(events["ai_generation_succeeded"] ?? 0),
    aiGenerationFailed: Number(events["ai_generation_failed"] ?? 0),
    reviewCopied: Number(events["review_copied"] ?? 0),
    googleReviewClicked: Number(events["google_review_clicked"] ?? 0),
    feedbackSaved: Number(events["feedback_saved"] ?? 0),
    pageOpened: Number(events["page_opened"] ?? 0),
    ratingSelected: Number(events["rating_selected"] ?? 0),
  };
}

export type FeedbackRow = {
  id: string;
  rating: number;
  feedbackText: string | null;
  consentNoticeVersion: string;
  createdAt: string;
};

export type FeedbackPage = {
  rows: FeedbackRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

type FeedbackRpcResult = {
  total: number;
  rows: Array<{
    id: string;
    rating: number;
    feedback_text: string | null;
    consent_notice_version: string;
    created_at: string;
  }>;
};

/**
 * Date handling note: `from` and `to` arrive as YYYY-MM-DD from the URL.
 * The end of a day is exclusive, so filtering `to=2026-11-07` includes all of
 * that day rather than stopping at midnight.
 */
export function dayBounds(
  from?: string,
  to?: string,
): {
  fromIso: string | null;
  toIso: string | null;
} {
  const fromIso = from ? new Date(`${from}T00:00:00.000Z`).toISOString() : null;
  let toIso: string | null = null;
  if (to) {
    const end = new Date(`${to}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    toIso = end.toISOString();
  }
  return { fromIso, toIso };
}

export async function getFeedbackPage(params: {
  page: number;
  limit: number;
  rating?: number;
  from?: string;
  to?: string;
}): Promise<FeedbackPage> {
  const { fromIso, toIso } = dayBounds(params.from, params.to);

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .rpc("get_feedback_page", {
      p_page: params.page,
      p_limit: params.limit,
      p_rating: params.rating ?? null,
      p_from: fromIso,
      p_to: toIso,
    })
    .single<FeedbackRpcResult>();

  if (error || !data) {
    console.error("[admin] feedback rpc failed", error?.code ?? "no data");
    throw new Error("Could not load feedback.");
  }

  const total = Number(data.total ?? 0);
  return {
    rows: (data.rows ?? []).map((row) => ({
      id: row.id,
      rating: row.rating,
      feedbackText: row.feedback_text,
      consentNoticeVersion: row.consent_notice_version,
      createdAt: row.created_at,
    })),
    total,
    page: params.page,
    limit: params.limit,
    totalPages: Math.max(1, Math.ceil(total / params.limit)),
  };
}
