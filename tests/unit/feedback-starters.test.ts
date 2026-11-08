import { describe, expect, it } from "vitest";
import {
  APPRECIATIVE_STARTERS,
  CONSTRUCTIVE_STARTERS,
  buildCombinedFeedback,
  startersForRating,
} from "@/lib/feedback-starters";

describe("startersForRating", () => {
  it("gives appreciative phrasing for 4 and 5 stars", () => {
    expect(startersForRating(5)).toBe(APPRECIATIVE_STARTERS);
    expect(startersForRating(4)).toBe(APPRECIATIVE_STARTERS);
  });

  it("gives constructive phrasing for 1 to 3 stars", () => {
    expect(startersForRating(3)).toBe(CONSTRUCTIVE_STARTERS);
    expect(startersForRating(2)).toBe(CONSTRUCTIVE_STARTERS);
    expect(startersForRating(1)).toBe(CONSTRUCTIVE_STARTERS);
  });

  it("does not hand an unhappy customer compliments", () => {
    // The sets must be disjoint so a 1-star customer is never shown praise.
    for (const phrase of CONSTRUCTIVE_STARTERS) {
      expect(APPRECIATIVE_STARTERS).not.toContain(phrase);
    }
  });

  it("falls back to constructive phrasing when the rating is missing", () => {
    expect(startersForRating(null)).toBe(CONSTRUCTIVE_STARTERS);
  });

  it("keeps every phrase short enough to read at a glance", () => {
    for (const phrase of [...APPRECIATIVE_STARTERS, ...CONSTRUCTIVE_STARTERS]) {
      // Roughly five to seven words; the cap allows a little slack.
      expect(phrase.trim().split(/\s+/).length).toBeLessThanOrEqual(7);
      expect(phrase.length).toBeLessThanOrEqual(48);
    }
  });
});

describe("buildCombinedFeedback", () => {
  it("returns empty string when nothing is selected or typed", () => {
    expect(buildCombinedFeedback([], "")).toBe("");
    expect(buildCombinedFeedback([], "   ")).toBe("");
  });

  it("returns just the typed text when no chips are selected", () => {
    expect(buildCombinedFeedback([], "Great service")).toBe("Great service.");
  });

  it("lets chips alone satisfy a non-empty review with no typing", () => {
    const text = buildCombinedFeedback(["Friendly and helpful staff"], "");
    expect(text).toBe("Friendly and helpful staff.");
  });

  it("puts the customer's own words first, then the chips", () => {
    const text = buildCombinedFeedback(
      ["Quick service with no waiting", "Clean and well-organised shop"],
      "Popped in for a charger",
    );
    expect(text).toBe(
      "Popped in for a charger. Quick service with no waiting. Clean and well-organised shop.",
    );
  });

  it("preserves the order the chips were selected in", () => {
    const text = buildCombinedFeedback(["B phrase", "A phrase"], "");
    expect(text).toBe("B phrase. A phrase.");
  });

  it("adds a full stop only when one is missing", () => {
    expect(buildCombinedFeedback([], "Already done!")).toBe("Already done!");
    expect(buildCombinedFeedback([], "No stop here")).toBe("No stop here.");
  });

  it("trims stray whitespace from every part", () => {
    expect(buildCombinedFeedback(["  padded phrase  "], "  typed  ")).toBe(
      "typed. padded phrase.",
    );
  });
});
