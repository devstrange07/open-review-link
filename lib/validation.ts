import { z } from "zod";
import { FEEDBACK_TOPIC_IDS } from "@/lib/feedback-topics";
import { LOCALES } from "@/lib/i18n/types";

/**
 * Shared validation contracts. Imported by both the API routes and the client
 * forms, so the same rules produce the same messages on both sides.
 */

export const MAX_FEEDBACK_LENGTH = 1500;
/** Soft hint for optional free text — not required to continue the journey. */
export const MIN_FEEDBACK_LENGTH = 5;
/** Upper bound for a generated draft after sanitising. */
export const MAX_REVIEW_LENGTH = 800;

export const ratingSchema = z
  .number({ invalid_type_error: "Select a star rating." })
  .int("Rating must be a whole number.")
  .min(1, "Rating must be at least 1.")
  .max(5, "Rating must be at most 5.");

/** Optional free-text feedback: empty is allowed; otherwise 1–1500 trimmed chars. */
export const optionalFeedbackTextSchema = z
  .string({ invalid_type_error: "Tell us about your experience." })
  .transform((value) => value.trim())
  .refine((value) => value.length <= MAX_FEEDBACK_LENGTH, {
    message: `Please keep it under ${MAX_FEEDBACK_LENGTH} characters.`,
  });

/** Required feedback text for AI draft generation. */
export const feedbackTextSchema = z
  .string({ invalid_type_error: "Tell us about your experience." })
  .transform((value) => value.trim())
  .refine((value) => value.length >= MIN_FEEDBACK_LENGTH, {
    message: `Please write at least ${MIN_FEEDBACK_LENGTH} characters.`,
  })
  .refine((value) => value.length <= MAX_FEEDBACK_LENGTH, {
    message: `Please keep it under ${MAX_FEEDBACK_LENGTH} characters.`,
  });

export const localeSchema = z.enum(LOCALES);

export const improvementTopicsSchema = z
  .array(
    z.enum(
      FEEDBACK_TOPIC_IDS as unknown as [
        (typeof FEEDBACK_TOPIC_IDS)[number],
        ...(typeof FEEDBACK_TOPIC_IDS)[number][],
      ],
    ),
  )
  .max(FEEDBACK_TOPIC_IDS.length)
  .default([]);

/**
 * AI draft needs enough signal: either substantial free text, or topics plus
 * any text. The route builds a combined prompt string from topics + text.
 */
export const reviewDraftRequestSchema = z
  .object({
    rating: ratingSchema,
    feedbackText: optionalFeedbackTextSchema,
    topics: improvementTopicsSchema.optional(),
    locale: localeSchema.optional().default("en"),
  })
  .superRefine((value, ctx) => {
    const topics = value.topics ?? [];
    const hasText = value.feedbackText.length >= MIN_FEEDBACK_LENGTH;
    if (!hasText && topics.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Add a topic or a few words so we can draft a review.",
        path: ["feedbackText"],
      });
    }
  });

export type ReviewDraftRequest = z.infer<typeof reviewDraftRequestSchema>;

const phoneDigitsSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\-()]/g, ""))
  .refine((value) => /^\+?[0-9]{8,15}$/.test(value), {
    message: "Enter a valid phone number with 8 to 15 digits.",
  });

/**
 * Storing feedback is the customer's decision to share private notes with the
 * shop. Written text and topics are optional; the published notice version
 * still travels with the row as consent evidence for processing.
 */
export const feedbackSubmissionSchema = z
  .object({
    rating: ratingSchema,
    feedbackText: optionalFeedbackTextSchema.optional().default(""),
    topics: improvementTopicsSchema.optional().default([]),
    consentNoticeVersion: z
      .string()
      .trim()
      .min(1)
      .max(32, "Consent notice version is too long."),
    followUpConsent: z.boolean().optional().default(false),
    contactPhone: z.string().trim().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.followUpConsent) {
      if (!value.contactPhone || value.contactPhone.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a phone number so we can reach you.",
          path: ["contactPhone"],
        });
        return;
      }
      const phone = phoneDigitsSchema.safeParse(value.contactPhone);
      if (!phone.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: phone.error.issues[0]?.message ?? "Enter a valid phone number.",
          path: ["contactPhone"],
        });
      }
    } else if (value.contactPhone && value.contactPhone.trim().length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please confirm we may contact you about this feedback.",
        path: ["followUpConsent"],
      });
    }
  })
  .transform((value) => {
    const followUpConsent = value.followUpConsent === true;
    let contactPhone: string | null = null;
    if (followUpConsent && value.contactPhone) {
      const phone = phoneDigitsSchema.safeParse(value.contactPhone);
      contactPhone = phone.success ? phone.data : null;
    }
    return {
      rating: value.rating,
      feedbackText: value.feedbackText ?? "",
      topics: value.topics ?? [],
      consentNoticeVersion: value.consentNoticeVersion,
      followUpConsent,
      contactPhone,
    };
  });

export type FeedbackSubmission = z.infer<typeof feedbackSubmissionSchema>;

/**
 * Analytics allowlist. Mirrors the analytics_events CHECK constraint in
 * migration 0001 — keep the two in sync.
 */
export const ANALYTICS_EVENTS = [
  "page_opened",
  "rating_selected",
  "ai_generation_succeeded",
  "ai_generation_failed",
  "feedback_saved",
  "review_copied",
  "google_review_clicked",
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export const analyticsEventSchema = z
  .object({
    eventName: z.enum(ANALYTICS_EVENTS),
  })
  .strict();

export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug is required.")
  .max(48, "Slug is too long.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens.",
  );

const httpsUrlSchema = z
  .string()
  .trim()
  .url("Enter a full URL, including https://")
  .refine((value) => value.startsWith("https://"), {
    message: "The URL must use https://",
  });

export const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Enter a hex colour like #245C47.");

/** Fields an admin may change. Anything else is stripped, not merged. */
export const settingsUpdateSchema = z
  .object({
    name: z.string().trim().min(1, "Shop name is required.").max(80),
    logoUrl: z.union([httpsUrlSchema, z.literal(""), z.null()]).optional(),
    primaryColor: hexColorSchema,
    welcomeTitle: z.string().trim().min(1, "Welcome heading is required.").max(80),
    welcomeMessage: z.string().trim().min(1, "Welcome message is required.").max(200),
    googleReviewUrl: httpsUrlSchema,
    contactEmail: z.string().trim().email("Enter a valid email address.").max(120),
    contactAddress: z.string().trim().max(200).optional(),
  })
  .strict();

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>;

export const feedbackQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.")
    .optional(),
});

export type FeedbackQuery = z.infer<typeof feedbackQuerySchema>;

export const OVERVIEW_RANGES = [7, 30, 90] as const;
export type OverviewRange = (typeof OVERVIEW_RANGES)[number];

export const overviewQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine(
      (value): value is OverviewRange =>
        (OVERVIEW_RANGES as readonly number[]).includes(value),
      { message: "Range must be 7, 30 or 90 days." },
    )
    .default(30),
});

/** Flatten a ZodError into a single user-facing sentence. */
export function firstIssueMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "That request was not valid.";
}

/** Build the text block sent to the AI from topics + free text. */
export function buildAiFeedbackSignal(input: {
  feedbackText: string;
  topics: string[];
  topicLabels?: Record<string, string>;
}): string {
  const parts: string[] = [];
  if (input.topics.length > 0) {
    const labels = input.topics.map(
      (id) => input.topicLabels?.[id] ?? id.replaceAll("_", " "),
    );
    parts.push(`Topics to improve: ${labels.join(", ")}.`);
  }
  if (input.feedbackText.trim()) {
    parts.push(input.feedbackText.trim());
  }
  return parts.join("\n\n");
}
