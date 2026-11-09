import { sanitizeReviewOutput } from "@/lib/ai/sanitize";
import { requestReviewDraft } from "@/lib/ai/provider";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBusinessSettings } from "@/lib/settings";
import { getMessages } from "@/lib/i18n";
import {
  apiError,
  apiOk,
  ERROR_CODES,
  guardOrigin,
  readJsonBody,
  toErrorResponse,
} from "@/lib/http";
import {
  buildAiFeedbackSignal,
  firstIssueMessage,
  reviewDraftRequestSchema,
} from "@/lib/validation";

/**
 * POST /api/review-draft
 *
 * Generates an AI-assisted draft. The customer's text is used transiently:
 * it goes to the provider, comes back as a draft, and is never written to the
 * database and never logged.
 */
export async function POST(request: Request) {
  const originError = guardOrigin(request);
  if (originError) return originError;

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

    const locale = parsed.data.locale ?? "en";
    const messages = getMessages(locale);
    const topics = parsed.data.topics ?? [];
    const feedbackText = buildAiFeedbackSignal({
      feedbackText: parsed.data.feedbackText,
      topics,
      topicLabels: messages.topics,
    });

    const result = await requestReviewDraft({
      rating: parsed.data.rating,
      feedbackText,
      shopName,
      locale,
    });

    if (!result.ok) {
      return apiError(result.error.code, result.error.message);
    }

    const sanitized = sanitizeReviewOutput(result.raw);
    if (!sanitized.ok) {
      console.warn(`[review-draft] rejected output reason=${sanitized.reason}`);
      return apiError(
        ERROR_CODES.AI_INVALID_OUTPUT,
        "We couldn't write a review from that text. Try adding a topic or a little more detail.",
      );
    }

    return apiOk({ reviewText: sanitized.text, language: locale });
  } catch (error) {
    return toErrorResponse(error, "review-draft");
  }
}
