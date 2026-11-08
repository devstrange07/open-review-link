import { describe, expect, it } from "vitest";
import {
  feedbackSubmissionSchema,
  feedbackTextSchema,
  ratingSchema,
  analyticsEventSchema,
  reviewDraftRequestSchema,
  settingsUpdateSchema,
  slugSchema,
  hexColorSchema,
  feedbackQuerySchema,
  overviewQuerySchema,
} from "@/lib/validation";

describe("rating", () => {
  it("accepts every valid rating", () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(ratingSchema.safeParse(rating).success).toBe(true);
    }
  });

  it("rejects out-of-range, fractional, and string values", () => {
    expect(ratingSchema.safeParse(0).success).toBe(false);
    expect(ratingSchema.safeParse(6).success).toBe(false);
    expect(ratingSchema.safeParse(3.5).success).toBe(false);
    expect(ratingSchema.safeParse("5").success).toBe(false);
    expect(ratingSchema.safeParse(null).success).toBe(false);
  });
});

describe("feedbackText", () => {
  it("trims surrounding whitespace before measuring", () => {
    const parsed = feedbackTextSchema.safeParse("   hello there   ");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe("hello there");
  });

  it("rejects text that is only whitespace", () => {
    expect(feedbackTextSchema.safeParse("     ").success).toBe(false);
  });

  it("rejects text shorter than the minimum once trimmed", () => {
    expect(feedbackTextSchema.safeParse("  hi  ").success).toBe(false);
  });

  it("accepts exactly the minimum and maximum lengths", () => {
    expect(feedbackTextSchema.safeParse("abcde").success).toBe(true);
    expect(feedbackTextSchema.safeParse("x".repeat(1500)).success).toBe(true);
    expect(feedbackTextSchema.safeParse("x".repeat(1501)).success).toBe(false);
  });
});

describe("feedbackSubmission", () => {
  const base = {
    rating: 5,
    feedbackText: "Staff were helpful.",
    consentNoticeVersion: "v1",
  };

  it("accepts a submission with only a rating, text and notice version", () => {
    // Sharing is implicit, so there is no consent flag to require.
    expect(feedbackSubmissionSchema.safeParse(base).success).toBe(true);
  });

  it("still requires a published notice version", () => {
    const { consentNoticeVersion: _omitted, ...withoutVersion } = base;
    expect(feedbackSubmissionSchema.safeParse(withoutVersion).success).toBe(false);
    expect(
      feedbackSubmissionSchema.safeParse({ ...base, consentNoticeVersion: "" }).success,
    ).toBe(false);
  });

  it("does not allow a client to supply ids or timestamps", () => {
    const withId = feedbackSubmissionSchema.safeParse({
      ...base,
      id: "00000000-0000-0000-0000-000000000000",
    });
    // Zod strips unknown keys by default; the route also re-parses with
    // .strict(). Assert the value never makes it into the output object.
    expect(withId.success).toBe(true);
    if (withId.success) {
      expect(Object.keys(withId.data)).toEqual([
        "rating",
        "feedbackText",
        "consentNoticeVersion",
      ]);
    }

    const strict = feedbackSubmissionSchema.strict().safeParse({
      ...base,
      businessId: 2,
    });
    expect(strict.success).toBe(false);
  });
});

describe("reviewDraftRequest", () => {
  it("rejects empty and too-short feedback", () => {
    expect(
      reviewDraftRequestSchema.safeParse({ rating: 5, feedbackText: "" }).success,
    ).toBe(false);
    expect(
      reviewDraftRequestSchema.safeParse({ rating: 5, feedbackText: "ok" }).success,
    ).toBe(false);
  });

  it("rejects an invalid rating even with valid text", () => {
    expect(
      reviewDraftRequestSchema.safeParse({ rating: 0, feedbackText: "Good shop" })
        .success,
    ).toBe(false);
  });

  it("accepts a complete, valid request", () => {
    const result = reviewDraftRequestSchema.safeParse({
      rating: 4,
      feedbackText: "  Friendly staff and quick service.  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.feedbackText).toBe("Friendly staff and quick service.");
    }
  });
});

describe("analyticsEvent", () => {
  it("accepts every allowlisted event name", () => {
    for (const name of [
      "page_opened",
      "rating_selected",
      "ai_generation_succeeded",
      "ai_generation_failed",
      "feedback_saved",
      "review_copied",
      "google_review_clicked",
    ]) {
      expect(analyticsEventSchema.safeParse({ eventName: name }).success).toBe(true);
    }
  });

  it("rejects unknown event names", () => {
    expect(
      analyticsEventSchema.safeParse({ eventName: "review_published" }).success,
    ).toBe(false);
  });

  it("rejects extra metadata fields", () => {
    expect(
      analyticsEventSchema.safeParse({ eventName: "review_copied", rating: 5 }).success,
    ).toBe(false);
    expect(
      analyticsEventSchema.safeParse({ eventName: "review_copied", email: "a@b.co" })
        .success,
    ).toBe(false);
  });
});

describe("settingsUpdate", () => {
  const valid = {
    name: "Shop",
    logoUrl: "",
    primaryColor: "#245C47",
    welcomeTitle: "Thanks!",
    welcomeMessage: "Tell us more.",
    googleReviewUrl: "https://g.page/r/abc/review",
    contactEmail: "owner@example.com",
    contactAddress: "",
  };

  it("accepts a valid payload", () => {
    expect(settingsUpdateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an http Google URL", () => {
    expect(
      settingsUpdateSchema.safeParse({ ...valid, googleReviewUrl: "http://g.page/x" })
        .success,
    ).toBe(false);
  });

  it("rejects a non-URL Google value", () => {
    expect(
      settingsUpdateSchema.safeParse({ ...valid, googleReviewUrl: "g.page/r/x" }).success,
    ).toBe(false);
  });

  it("rejects a malformed contact email", () => {
    expect(
      settingsUpdateSchema.safeParse({ ...valid, contactEmail: "not-an-email" }).success,
    ).toBe(false);
  });

  it("rejects unknown fields (mass-assignment guard)", () => {
    expect(settingsUpdateSchema.safeParse({ ...valid, slug: "hijacked" }).success).toBe(
      false,
    );
    expect(
      settingsUpdateSchema.safeParse({ ...valid, privacy_notice_version: "v9" }).success,
    ).toBe(false);
  });

  it("accepts a null logo to clear it", () => {
    expect(settingsUpdateSchema.safeParse({ ...valid, logoUrl: null }).success).toBe(
      true,
    );
  });
});

describe("slug and colour formats", () => {
  it("accepts lowercase hyphenated slugs", () => {
    expect(slugSchema.safeParse("shop").success).toBe(true);
    expect(slugSchema.safeParse("the-green-shop").success).toBe(true);
    expect(slugSchema.safeParse("shop2").success).toBe(true);
  });

  it("rejects slugs that would break a URL path", () => {
    expect(slugSchema.safeParse("Shop").success).toBe(false);
    expect(slugSchema.safeParse("two--hyphens").success).toBe(false);
    expect(slugSchema.safeParse("-leading").success).toBe(false);
    expect(slugSchema.safeParse("has space").success).toBe(false);
    expect(slugSchema.safeParse("slash/inside").success).toBe(false);
  });

  it("accepts 3 and 6 digit hex", () => {
    expect(hexColorSchema.safeParse("#fff").success).toBe(true);
    expect(hexColorSchema.safeParse("#245C47").success).toBe(true);
    expect(hexColorSchema.safeParse("245C47").success).toBe(false);
    expect(hexColorSchema.safeParse("#gggggg").success).toBe(false);
  });
});

describe("feedbackQuery", () => {
  it("applies safe defaults", () => {
    const parsed = feedbackQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(1);
      expect(parsed.data.limit).toBe(20);
    }
  });

  it("coerces numeric strings from the query string", () => {
    const parsed = feedbackQuerySchema.safeParse({ page: "2", limit: "50", rating: "4" });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.page).toBe(2);
      expect(parsed.data.limit).toBe(50);
      expect(parsed.data.rating).toBe(4);
    }
  });

  it("caps limit so a hand-edited URL cannot request everything", () => {
    expect(feedbackQuerySchema.safeParse({ limit: "5000" }).success).toBe(false);
  });

  it("rejects a page below 1", () => {
    expect(feedbackQuerySchema.safeParse({ page: "0" }).success).toBe(false);
    expect(feedbackQuerySchema.safeParse({ page: "-3" }).success).toBe(false);
  });

  it("rejects malformed dates", () => {
    expect(feedbackQuerySchema.safeParse({ from: "07/11/2026" }).success).toBe(false);
    expect(feedbackQuerySchema.safeParse({ from: "2026-11-07" }).success).toBe(true);
  });
});

describe("overviewQuery", () => {
  it("accepts only the three supported windows", () => {
    for (const days of ["7", "30", "90"]) {
      expect(overviewQuerySchema.safeParse({ days }).success).toBe(true);
    }
    expect(overviewQuerySchema.safeParse({ days: "365" }).success).toBe(false);
    expect(overviewQuerySchema.safeParse({ days: "0" }).success).toBe(false);
  });

  it("defaults to 30 days", () => {
    const parsed = overviewQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.days).toBe(30);
  });
});
