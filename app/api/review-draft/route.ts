import { sanitizeReviewOutput } from "@/lib/ai/sanitize";
import { requestReviewDraft } from "@/lib/ai/provider";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBusinessSettings } from "@/lib/settings";
import {
  apiError,
  apiOk,
  ERROR_CODES,
  guardOrigin,
  readJsonBody,
  toErrorResponse,
} from "@/lib/http";
import { reviewDraftRequestSchema, firstIssueMessage } from "@/lib/validation";

/**
 * POST /api/review-draft
 *
 * Generates an AI-assisted draft. The customer's text is used transiently:
 * it goes to the provider, comes back as a draft, and is never written to the
 * database and never logged.
 *
 * Failure policy: every branch returns a friendly message and a stable code.
 * The customer's original text lives in their browser, so nothing is lost.
 */
export async function POST(request: Request) {
  const originError = guardOrigin(request);
  if (originError) return originError;

  // Size and content-type are checked before the rate limiter on purpose: an
  // abusive caller sending 20MB bodies must not get to consume anyone's budget,
  // and the cheapest rejection should be the first one.
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const rate = await checkRateLimit("reviewDraft", request);
  if (!rate.allowed) {
    return apiError(ERROR_CODES.RATE_LIMITED, undefined, {
      "retry-after": String(rate.retryAfterSeconds ?? 60),
    });
  }

  try {
    const parsed = reviewDraftRequestSchema.safeParse(body.data);
    if (!parsed.success) {
      return apiError(ERROR_CODES.VALIDATION_ERROR, firstIssueMessage(parsed.error));
    }

    let shopName = "this shop";
    try {
      const settings = await getBusinessSettings();
      if (settings) shopName = settings.name;
    } catch {
      // A config read failure should not block drafting; the generic name works.
    }

    const result = await requestReviewDraft({
      rating: parsed.data.rating,
      feedbackText: parsed.data.feedbackText,
      shopName,
    });

    if (!result.ok) {
      return apiError(result.error.code, result.error.message);
    }

    const sanitized = sanitizeReviewOutput(result.raw);
    if (!sanitized.ok) {
      // Log the reason, never the text. This is the signal that the prompt or
      // the model has drifted, and it should be visible in production logs.
      console.warn(`[review-draft] rejected output reason=${sanitized.reason}`);
      return apiError(
        ERROR_CODES.AI_INVALID_OUTPUT,
        "We couldn't write a review from that text. Try adding a little more detail.",
      );
    }

    return apiOk({ reviewText: sanitized.text, language: "en" });
  } catch (error) {
    return toErrorResponse(error, "review-draft");
  }
}
