import { describe, expect, it } from "vitest";
import {
  feedbackSubmissionSchema,
  feedbackTextSchema,
  optionalFeedbackTextSchema,
  ratingSchema,
  analyticsEventSchema,
  reviewDraftRequestSchema,
  settingsUpdateSchema,
  slugSchema,
  hexColorSchema,
  feedbackQuerySchema,
  overviewQuerySchema,
  buildAiFeedbackSignal,
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

describe("optionalFeedbackText", () => {
  it("allows empty text", () => {
    const parsed = optionalFeedbackTextSchema.safeParse("");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe("");
  });

  it("trims and accepts short notes", () => {
    const parsed = optionalFeedbackTextSchema.safeParse("  hi  ");
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toBe("hi");
  });

  it("rejects text over the maximum", () => {
    expect(optionalFeedbackTextSchema.safeParse("x".repeat(1501)).success).toBe(false);
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
    consentNoticeVersion: "v2",
  };

  it("accepts a submission with rating, text and notice version", () => {
    expect(feedbackSubmissionSchema.safeParse(base).success).toBe(true);
  });

  it("accepts rating-only with empty text and no topics", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        rating: 4,
        feedbackText: "",
        consentNoticeVersion: "v2",
      }).success,
    ).toBe(true);
  });

  it("accepts topic-only feedback without free text", () => {
    const result = feedbackSubmissionSchema.safeParse({
      rating: 3,
      topics: ["staff_assistance", "pricing_and_offers"],
      consentNoticeVersion: "v2",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topics).toEqual(["staff_assistance", "pricing_and_offers"]);
      expect(result.data.feedbackText).toBe("");
    }
  });

  it("still requires a published notice version", () => {
    const { consentNoticeVersion: _omitted, ...withoutVersion } = base;
    expect(feedbackSubmissionSchema.safeParse(withoutVersion).success).toBe(false);
    expect(
      feedbackSubmissionSchema.safeParse({ ...base, consentNoticeVersion: "" }).success,
    ).toBe(false);
  });

  it("rejects unknown keys under strict parsing", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        ...base,
        id: "00000000-0000-0000-0000-000000000000",
      }).success,
    ).toBe(false);
    expect(
      feedbackSubmissionSchema.safeParse({
        ...base,
        businessId: 2,
      }).success,
    ).toBe(false);
  });

  it("rejects a phone without follow-up consent", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        ...base,
        contactPhone: "9876543210",
        followUpConsent: false,
      }).success,
    ).toBe(false);
  });

  it("rejects follow-up consent without a phone", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        ...base,
        followUpConsent: true,
      }).success,
    ).toBe(false);
  });

  it("accepts follow-up with consent and a valid phone", () => {
    const result = feedbackSubmissionSchema.safeParse({
      rating: 2,
      feedbackText: "",
      topics: ["billing_experience"],
      consentNoticeVersion: "v2",
      followUpConsent: true,
      contactPhone: "+91 98765-43210",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.followUpConsent).toBe(true);
      expect(result.data.contactPhone).toBe("+919876543210");
    }
  });

  it("rejects an invalid topic id", () => {
    expect(
      feedbackSubmissionSchema.safeParse({
        ...base,
        topics: ["not_a_real_topic"],
      }).success,
    ).toBe(false);
  });
});

describe("reviewDraftRequest", () => {
  it("rejects empty feedback without topics", () => {
    expect(
      reviewDraftRequestSchema.safeParse({ rating: 5, feedbackText: "" }).success,
    ).toBe(false);
    expect(
      reviewDraftRequestSchema.safeParse({ rating: 5, feedbackText: "ok" }).success,
    ).toBe(false);
  });

  it("accepts topics alone as AI signal", () => {
    const result = reviewDraftRequestSchema.safeParse({
      rating: 3,
      feedbackText: "",
      topics: ["after_sales_service"],
      locale: "hi",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.locale).toBe("hi");
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

describe("buildAiFeedbackSignal", () => {
  it("merges topic labels and free text", () => {
    expect(
      buildAiFeedbackSignal({
        feedbackText: "Waited too long.",
        topics: ["staff_assistance"],
        topicLabels: { staff_assistance: "Staff assistance" },
      }),
    ).toContain("Staff assistance");
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
    ] as const) {
      expect(analyticsEventSchema.safeParse({ eventName: name }).success).toBe(true);
    }
  });

  it("rejects unknown event names and extra keys", () => {
    expect(
      analyticsEventSchema.safeParse({ eventName: "something_else" }).success,
    ).toBe(false);
    expect(
      analyticsEventSchema.safeParse({
        eventName: "page_opened",
        rating: 5,
      }).success,
    ).toBe(false);
  });
});

describe("slug", () => {
  it("accepts a lowercase hyphenated slug", () => {
    expect(slugSchema.safeParse("poojara-telecom-kalol").success).toBe(true);
  });

  it("rejects uppercase, spaces, and leading hyphens", () => {
    expect(slugSchema.safeParse("Poojara").success).toBe(false);
    expect(slugSchema.safeParse("poojara telecom").success).toBe(false);
    expect(slugSchema.safeParse("-poojara").success).toBe(false);
  });
});

describe("hexColor", () => {
  it("accepts 3- and 6-digit hex colours", () => {
    expect(hexColorSchema.safeParse("#245C47").success).toBe(true);
    expect(hexColorSchema.safeParse("#abc").success).toBe(true);
  });

  it("rejects missing hash and non-hex", () => {
    expect(hexColorSchema.safeParse("245C47").success).toBe(false);
    expect(hexColorSchema.safeParse("#gg0000").success).toBe(false);
  });
});

describe("settingsUpdate", () => {
  const valid = {
    name: "Poojara Telecom",
    primaryColor: "#245C47",
    welcomeTitle: "Thanks for visiting",
    welcomeMessage: "Tell us how we did.",
    googleReviewUrl: "https://g.page/r/example/review",
    contactEmail: "shop@example.com",
  };

  it("accepts a complete settings payload", () => {
    expect(settingsUpdateSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects http Google review URLs", () => {
    expect(
      settingsUpdateSchema.safeParse({
        ...valid,
        googleReviewUrl: "http://g.page/r/example/review",
      }).success,
    ).toBe(false);
  });

  it("rejects attempts to patch privacy_notice_version", () => {
    expect(
      settingsUpdateSchema.safeParse({ ...valid, privacy_notice_version: "v9" }).success,
    ).toBe(false);
  });
});

describe("feedbackQuery", () => {
  it("applies defaults for page and limit", () => {
    const result = feedbackQuerySchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(1);
      expect(result.data.limit).toBe(20);
    }
  });
});

describe("overviewQuery", () => {
  it("accepts 7, 30 and 90", () => {
    for (const days of [7, 30, 90]) {
      expect(overviewQuerySchema.safeParse({ days }).success).toBe(true);
    }
  });

  it("rejects other day counts", () => {
    expect(overviewQuerySchema.safeParse({ days: 14 }).success).toBe(false);
  });
});
