import { BUSINESS_ID } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessSettings } from "@/lib/settings";
import { recordEvent } from "@/lib/analytics";
import {
  apiError,
  apiOk,
  ERROR_CODES,
  guardOrigin,
  readJsonBody,
  toErrorResponse,
} from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { feedbackSubmissionSchema, firstIssueMessage } from "@/lib/validation";

/**
 * POST /api/feedback
 *
 * Stores the customer's private written feedback. Sharing is implicit: the
 * customer typed it into this flow and asked for a review, so *that action* is
 * the consent. Nothing is stored silently — the row carries the published
 * notice version the customer was shown, which is the consent evidence.
 *
 * Defences, in order:
 *   1. Same-origin check.
 *   2. Rate limit.
 *   3. Strict schema, so a client cannot smuggle `id`, `created_at` or
 *      `business_id` into the row.
 *   4. `business_id` and `consented_at` are set here, never read from input.
 */
export async function POST(request: Request) {
  const originError = guardOrigin(request);
  if (originError) return originError;

  // Cheapest rejections first: an oversized or malformed body should never
  // consume the caller's budget.
  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const rate = await checkRateLimit("feedback", request);
  if (!rate.allowed) {
    return apiError(ERROR_CODES.RATE_LIMITED, undefined, {
      "retry-after": String(rate.retryAfterSeconds ?? 60),
    });
  }

  try {
    const parsed = feedbackSubmissionSchema.strict().safeParse(body.data);
    if (!parsed.success) {
      return apiError(ERROR_CODES.VALIDATION_ERROR, firstIssueMessage(parsed.error));
    }

    // Cross-check the notice version against the live configuration. A client
    // can claim any string; only the version currently published is valid
    // evidence of what the customer was shown.
    const settings = await getBusinessSettings();
    if (!settings) return apiError(ERROR_CODES.INTERNAL_ERROR);

    if (parsed.data.consentNoticeVersion !== settings.privacyNoticeVersion) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "The privacy notice has been updated. Please review it and try again.",
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("feedback_submissions").insert({
      business_id: BUSINESS_ID,
      rating: parsed.data.rating,
      feedback_text: parsed.data.feedbackText,
      consent_notice_version: parsed.data.consentNoticeVersion,
      // Server clock, not the client's.
      consented_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[feedback] insert failed", error.code);
      return apiError(ERROR_CODES.INTERNAL_ERROR);
    }

    void recordEvent("feedback_saved");

    return apiOk({ message: "Feedback received." });
  } catch (error) {
    return toErrorResponse(error, "feedback");
  }
}
