import { MAX_REVIEW_LENGTH } from "@/lib/validation";

/**
 * Provider output sanitisation.
 *
 * Models wrap answers in quotes, prepend "Here's your review:", or emit a
 * refusal. We reject refusals rather than showing them, and strip the wrapping
 * so the customer edits prose and not formatting.
 *
 * Everything here is a pure function of the model's string, so it is easy to
 * test against real provider oddities.
 */

export type SanitizeResult =
  | { ok: true; text: string }
  | { ok: false; reason: "empty" | "too_long" | "refusal" | "not_prose" };

/** Openers that mean the model declined or explained instead of writing. */
const REFUSAL_PATTERNS: RegExp[] = [
  /^as an ai\b/i,
  /^i'?m sorry\b/i,
  /^i am sorry\b/i,
  /^i apologi[sz]e\b/i,
  /^i can(?:'|no)t\b/i,
  /^i'm unable\b/i,
  /^i am unable\b/i,
  /^sorry,? but\b/i,
  /^i (?:don't|do not) have (?:enough|the ability)\b/i,
  /^unfortunately\b/i,
];

/** Preambles that are safe to strip and keep what follows. */
const PREAMBLE_PATTERNS: RegExp[] = [
  /^(?:here(?:'| i)?s|here is)\s+(?:your|the|a)\s+(?:review|rewritten review|draft)\s*[:—-]\s*/i,
  /^(?:sure|certainly|of course)[,!.]?\s*/i,
  /^review\s*[:—-]\s*/i,
  /^(?:rewritten|improved)\s+review\s*[:—-]\s*/i,
];

function stripWrappingQuotes(text: string): string {
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["\u201C", "\u201D"], // curly double
    ["\u2018", "\u2019"], // curly single
    ["`", "`"],
    ["**", "**"],
  ];
  let result = text;
  for (const [open, close] of pairs) {
    if (
      result.length > open.length + close.length &&
      result.startsWith(open) &&
      result.endsWith(close)
    ) {
      result = result.slice(open.length, result.length - close.length).trim();
    }
  }
  return result;
}

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```[a-z]*\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .trim();
}

export function sanitizeReviewOutput(raw: string | null | undefined): SanitizeResult {
  if (!raw) return { ok: false, reason: "empty" };

  let text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return { ok: false, reason: "empty" };

  text = stripMarkdownFences(text);

  for (const pattern of REFUSAL_PATTERNS) {
    if (pattern.test(text)) return { ok: false, reason: "refusal" };
  }

  for (const pattern of PREAMBLE_PATTERNS) {
    text = text.replace(pattern, "");
  }

  text = stripWrappingQuotes(text.trim());

  // Collapse runs of whitespace but keep paragraph breaks meaningful.
  text = text
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!text) return { ok: false, reason: "empty" };

  // A "review" with no letters is not a review (e.g. "5/5", "N/A").
  if (!/\p{L}/u.test(text)) return { ok: false, reason: "not_prose" };

  if (text.length > MAX_REVIEW_LENGTH) {
    // Truncating mid-sentence would read as broken to the customer, so reject
    // and let them retry rather than showing a clipped review.
    return { ok: false, reason: "too_long" };
  }

  return { ok: true, text };
}
