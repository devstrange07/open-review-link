import { describe, expect, it } from "vitest";
import { sanitizeReviewOutput } from "@/lib/ai/sanitize";

/**
 * These cases mirror the oddities real providers produce. Each one either
 * cleans up to usable prose or is rejected outright — never shown half-broken
 * to a customer.
 */

describe("sanitizeReviewOutput — accepts and cleans", () => {
  it("returns plain prose unchanged", () => {
    const text = "The staff were friendly and the shop was clean.";
    const result = sanitizeReviewOutput(text);
    expect(result).toEqual({ ok: true, text });
  });

  it("strips straight wrapping quotes", () => {
    const result = sanitizeReviewOutput('"Great service, fair prices."');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("Great service, fair prices.");
  });

  it("strips curly quotes", () => {
    const result = sanitizeReviewOutput("\u201CNice little shop.\u201D");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("Nice little shop.");
  });

  it("strips a markdown code fence", () => {
    const result = sanitizeReviewOutput("```\nGood quality products.\n```");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("Good quality products.");
  });

  it("strips a lowercase code fence with a language tag", () => {
    const result = sanitizeReviewOutput("```text\nHelpful and quick.\n```");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("Helpful and quick.");
  });

  it("removes a 'Here is your review:' preamble", () => {
    const result = sanitizeReviewOutput("Here is your review: The staff were helpful.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("The staff were helpful.");
  });

  it("removes a 'Sure,' opener", () => {
    const result = sanitizeReviewOutput("Sure! The shop had everything I needed.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("The shop had everything I needed.");
  });

  it("removes a 'Review:' label", () => {
    const result = sanitizeReviewOutput("Review: Clean store, polite staff.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("Clean store, polite staff.");
  });

  it("collapses runs of whitespace", () => {
    const result = sanitizeReviewOutput("Too    many     spaces here.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("Too many spaces here.");
  });

  it("keeps paragraph breaks but collapses triples", () => {
    const result = sanitizeReviewOutput("First part.\n\n\n\nSecond part.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe("First part.\n\nSecond part.");
  });

  it("preserves negative sentiment rather than softening it", () => {
    const text = "The wait was far too long and nobody apologised.";
    const result = sanitizeReviewOutput(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text).toBe(text);
  });
});

describe("sanitizeReviewOutput — rejects", () => {
  it("rejects empty, null and undefined", () => {
    expect(sanitizeReviewOutput("")).toEqual({ ok: false, reason: "empty" });
    expect(sanitizeReviewOutput("   ")).toEqual({ ok: false, reason: "empty" });
    expect(sanitizeReviewOutput(null)).toEqual({ ok: false, reason: "empty" });
    expect(sanitizeReviewOutput(undefined)).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects an output that is only a fence", () => {
    expect(sanitizeReviewOutput("```\n\n```")).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects provider refusals", () => {
    const refusals = [
      "As an AI language model, I cannot write reviews.",
      "I'm sorry, but I can't help with that.",
      "I apologize, but I am unable to assist.",
      "Unfortunately, I cannot generate this review.",
      "I can't do that.",
      "I don't have enough information to write a review.",
    ];
    for (const refusal of refusals) {
      expect(sanitizeReviewOutput(refusal), refusal).toEqual({
        ok: false,
        reason: "refusal",
      });
    }
  });

  it("rejects output with no letters", () => {
    expect(sanitizeReviewOutput("5/5")).toEqual({ ok: false, reason: "not_prose" });
    expect(sanitizeReviewOutput("!!!")).toEqual({ ok: false, reason: "not_prose" });
  });

  it("rejects output over the length cap instead of truncating", () => {
    const long = "word ".repeat(400);
    expect(sanitizeReviewOutput(long)).toEqual({ ok: false, reason: "too_long" });
  });

  it("accepts output exactly at the cap", () => {
    const exact = "a".repeat(800);
    const result = sanitizeReviewOutput(exact);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text.length).toBe(800);
  });
});
