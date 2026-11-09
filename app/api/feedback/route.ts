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
 * Stores the customer's private feedback (rating, optional topics/text, and
 * optional follow-up phone with explicit consent). Returns a public reference
 * the customer can quote for deletion requests.
 *
 * Defences, in order:
 *   1. Same-origin check.
 *   2. Rate limit.
 *   3. Strict schema, so a client cannot smuggle `id`, `created_at` or
 *      `business_id` into the row.
 *   4. `business_id`, `consented_at`, and `public_reference` are set here.
 */
export async function POST(request: Request) {
  const originError = guardOrigin(request);
  if (originError) return originError;

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  const rate = await checkRateLimit("feedback", request);
  if (!rate.allowed) {
    return apiError(ERROR_CODES.RATE_LIMITED, undefined, {
      "retry-after": String(rate.retryAfterSeconds ?? 60),
    });
  }

  try {
    const parsed = feedbackSubmissionSchema.safeParse(body.data);
    if (!parsed.success) {
      return apiError(ERROR_CODES.VALIDATION_ERROR, firstIssueMessage(parsed.error));
    }

    const settings = await getBusinessSettings();
    if (!settings) return apiError(ERROR_CODES.INTERNAL_ERROR);

    if (parsed.data.consentNoticeVersion !== settings.privacyNoticeVersion) {
      return apiError(
        ERROR_CODES.VALIDATION_ERROR,
        "The privacy notice has been updated. Please review it and try again.",
      );
    }

    const now = new Date().toISOString();
    const followUp = parsed.data.followUpConsent && parsed.data.contactPhone;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("feedback_submissions")
      .insert({
        business_id: BUSINESS_ID,
        rating: parsed.data.rating,
        feedback_text: parsed.data.feedbackText || null,
        improvement_topics: parsed.data.topics,
        consent_notice_version: parsed.data.consentNoticeVersion,
        consented_at: now,
        follow_up_consent: Boolean(followUp),
        follow_up_consent_at: followUp ? now : null,
        contact_phone: followUp ? parsed.data.contactPhone : null,
      })
      .select("public_reference")
      .single();

    if (error || !data?.public_reference) {
      console.error("[feedback] insert failed", error?.code);
      return apiError(ERROR_CODES.INTERNAL_ERROR);
    }

    void recordEvent("feedback_saved");

    return apiOk({
      message: "Feedback received.",
      reference: data.public_reference as string,
    });
  } catch (error) {
    return toErrorResponse(error, "feedback");
  }
}
