import { requireAdmin } from "@/lib/auth";
import { getFeedbackPage } from "@/lib/admin-queries";
import { apiError, apiOk, ERROR_CODES, toErrorResponse } from "@/lib/http";
import { feedbackQuerySchema, firstIssueMessage } from "@/lib/validation";

/**
 * GET /api/admin/feedback?page=&limit=&rating=&from=&to=
 *
 * Pagination happens in SQL, newest-first, on an indexed column. The client
 * cannot request a different sort order.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.status === "unauthenticated") return apiError(ERROR_CODES.UNAUTHENTICATED);
  if (auth.status === "not_admin") return apiError(ERROR_CODES.NOT_ADMIN);

  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const parsed = feedbackQuerySchema.safeParse(query);

  if (!parsed.success) {
    return apiError(ERROR_CODES.VALIDATION_ERROR, firstIssueMessage(parsed.error));
  }

  // A reversed range would silently return zero rows; say so instead.
  if (parsed.data.from && parsed.data.to && parsed.data.from > parsed.data.to) {
    return apiError(
      ERROR_CODES.VALIDATION_ERROR,
      "The start date is after the end date.",
    );
  }

  try {
    const data = await getFeedbackPage(parsed.data);
    return apiOk({ feedback: data }, { "cache-control": "private, no-store" });
  } catch (error) {
    return toErrorResponse(error, "admin-feedback");
  }
}
