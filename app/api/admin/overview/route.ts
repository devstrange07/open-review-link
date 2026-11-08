import { requireAdmin } from "@/lib/auth";
import { getOverview } from "@/lib/admin-queries";
import { apiError, apiOk, ERROR_CODES, toErrorResponse } from "@/lib/http";
import { overviewQuerySchema, firstIssueMessage } from "@/lib/validation";

/**
 * GET /api/admin/overview?days=7|30|90
 *
 * Metrics are counts of events, not proof of unique customers or of published
 * Google reviews. The response shape keeps "Google link clicks" separate from
 * anything that could be mistaken for a completed review.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.status === "unauthenticated") return apiError(ERROR_CODES.UNAUTHENTICATED);
  if (auth.status === "not_admin") return apiError(ERROR_CODES.NOT_ADMIN);

  const url = new URL(request.url);
  const parsed = overviewQuerySchema.safeParse({
    days: url.searchParams.get("days") ?? undefined,
  });

  if (!parsed.success) {
    return apiError(ERROR_CODES.VALIDATION_ERROR, firstIssueMessage(parsed.error));
  }

  try {
    const data = await getOverview(parsed.data.days);
    return apiOk({ overview: data }, { "cache-control": "private, no-store" });
  } catch (error) {
    return toErrorResponse(error, "admin-overview");
  }
}
