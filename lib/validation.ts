import { z } from "zod";

/**
 * Shared validation contracts. Imported by both the API routes and the client
 * forms, so the same rules produce the same messages on both sides.
 */

export const MAX_FEEDBACK_LENGTH = 1500;
export const MIN_FEEDBACK_LENGTH = 5;
/** Upper bound for a generated draft after sanitising. */
export const MAX_REVIEW_LENGTH = 800;

export const ratingSchema = z
  .number({ invalid_type_error: "Select a star rating." })
  .int("Rating must be a whole number.")
  .min(1, "Rating must be at least 1.")
  .max(5, "Rating must be at most 5.");

export const feedbackTextSchema = z
  .string({ invalid_type_error: "Tell us about your experience." })
  .transform((value) => value.trim())
  .refine((value) => value.length >= MIN_FEEDBACK_LENGTH, {
    message: `Please write at least ${MIN_FEEDBACK_LENGTH} characters.`,
  })
  .refine((value) => value.length <= MAX_FEEDBACK_LENGTH, {
    message: `Please keep it under ${MAX_FEEDBACK_LENGTH} characters.`,
  });

export const reviewDraftRequestSchema = z.object({
  rating: ratingSchema,
  feedbackText: feedbackTextSchema,
});

export type ReviewDraftRequest = z.infer<typeof reviewDraftRequestSchema>;

/**
 * Storing feedback is implicit: writing it into the flow and pressing generate
 * *is* the customer's decision to share it. The published notice version still
 * travels with the row, so each stored submission records which privacy notice
 * the customer was shown — that is the consent evidence.
 */
export const feedbackSubmissionSchema = z.object({
  rating: ratingSchema,
  feedbackText: feedbackTextSchema,
  consentNoticeVersion: z
    .string()
    .trim()
    .min(1)
    .max(32, "Consent notice version is too long."),
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
