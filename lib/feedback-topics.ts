/**
 * Improvement topics for the optional “What could we improve?” step.
 *
 * Ids are stored in the database; labels are translated in the i18n layer.
 */

export const FEEDBACK_TOPIC_IDS = [
  "product_availability",
  "pricing_and_offers",
  "staff_assistance",
  "product_knowledge",
  "billing_experience",
  "after_sales_service",
  "something_else",
] as const;

export type FeedbackTopicId = (typeof FEEDBACK_TOPIC_IDS)[number];

export function isFeedbackTopicId(value: string): value is FeedbackTopicId {
  return (FEEDBACK_TOPIC_IDS as readonly string[]).includes(value);
}

export function filterValidTopicIds(values: unknown): FeedbackTopicId[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<FeedbackTopicId>();
  for (const value of values) {
    if (typeof value === "string" && isFeedbackTopicId(value) && !seen.has(value)) {
      seen.add(value);
    }
  }
  return [...seen];
}
