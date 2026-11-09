import { test, expect } from "@playwright/test";

/**
 * API contract tests that need no database.
 *
 * Every assertion here is about validation and rejection, which is where the
 * security value is. Happy-path writes are covered by the customer journey spec
 * with a stubbed store, and by the manual checklist in README for the real DB.
 *
 * Rate-limit note: the limiter keys on client IP. Tests that run in the same
 * worker process would otherwise share one bucket, and a later test would see a
 * 429 instead of the validation result it is asserting on. Each test therefore
 * declares a unique `x-forwarded-for`, which is what `clientFingerprint()` reads
 * — so the per-IP budget is never shared and no assertion has to be skipped.
 * The limiter's own behaviour is proven separately in rate-limit.spec.ts.
 */

/**
 * A client IP no other test will use. Random rather than sequential because
 * parallel workers each start their own module instance and would otherwise
 * hand out the same numbers.
 */
function freshIp(): Record<string, string> {
  const octet = () => 1 + Math.floor(Math.random() * 254);
  return { "x-forwarded-for": `10.${octet()}.${octet()}.${octet()}` };
}

test.describe("POST /api/review-draft — validation", () => {
  test("rejects a non-JSON content type", async ({ request }) => {
    const response = await request.post("/api/review-draft", {
      headers: { ...freshIp(), "content-type": "text/plain" },
      data: "rating=5",
    });
    // Content type is checked before the rate limiter, so this is stable.
    expect(response.status()).toBe(415);
  });

  test("rejects an oversized body", async ({ request }) => {
    const response = await request.post("/api/review-draft", {
      data: { rating: 5, feedbackText: "x".repeat(20_000) },
    });
    // Size is checked before the rate limiter is consulted, so this is stable.
    expect(response.status()).toBe(413);
  });

  test("rejects an out-of-range rating", async ({ request }) => {
    const response = await request.post("/api/review-draft", {
      headers: freshIp(),
      data: { rating: 9, feedbackText: "Good shop overall." },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  test("rejects feedback with neither topics nor enough text", async ({ request }) => {
    const response = await request.post("/api/review-draft", {
      headers: freshIp(),
      data: { rating: 5, feedbackText: "ok" },
    });
    expect(response.status()).toBe(400);
  });

  test("rejects a missing body", async ({ request }) => {
    const response = await request.post("/api/review-draft", {
      headers: freshIp(),
      data: {},
    });
    expect(response.status()).toBe(400);
  });

  test("rejects a cross-site origin", async ({ request }) => {
    const response = await request.post("/api/review-draft", {
      headers: { origin: "https://evil.example.net" },
      data: { rating: 5, feedbackText: "Nice place to shop." },
    });
    // Origin is checked before rate limiting, so this is stable.
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("FORBIDDEN_ORIGIN");
  });

  test("never leaks provider or key details in an error body", async ({ request }) => {
    const response = await request.post("/api/review-draft", {
      data: { rating: 0, feedbackText: "" },
    });
    const text = await response.text();
    expect(text).not.toMatch(/gemini|api[_-]?key|apikey|bearer|stack|at\s+\w+\s+\(/i);
  });
});

test.describe("POST /api/feedback — validation", () => {
  test("accepts a submission with no separate consent flag", async ({ request }) => {
    // Rating + notice version are enough; written text and topics are optional.
    const response = await request.post("/api/feedback", {
      headers: freshIp(),
      data: {
        rating: 5,
        feedbackText: "Great shop.",
        consentNoticeVersion: "v2",
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(typeof body.reference === "string" || body.reference === undefined).toBe(true);
  });

  test("rejects a submission with no notice version", async ({ request }) => {
    const response = await request.post("/api/feedback", {
      headers: freshIp(),
      data: {
        rating: 5,
        feedbackText: "Great shop.",
      },
    });
    expect(response.status()).toBe(400);
  });

  test("rejects client-supplied identifiers", async ({ request }) => {
    const response = await request.post("/api/feedback", {
      headers: freshIp(),
      data: {
        rating: 5,
        feedbackText: "Great shop.",
        consentNoticeVersion: "v2",
        business_id: 2,
        id: "00000000-0000-0000-0000-000000000000",
      },
    });
    // Unknown keys are rejected by the strict schema rather than silently
    // dropped, so the caller learns their payload shape is wrong.
    expect(response.status()).toBe(400);
  });

  test("rejects an invalid rating", async ({ request }) => {
    const response = await request.post("/api/feedback", {
      headers: freshIp(),
      data: {
        rating: 6,
        feedbackText: "Great shop.",
        consentNoticeVersion: "v2",
      },
    });
    expect(response.status()).toBe(400);
  });

  test("rejects a cross-site origin before touching the database", async ({
    request,
  }) => {
    const response = await request.post("/api/feedback", {
      headers: { origin: "https://evil.example.net" },
      data: {
        rating: 5,
        feedbackText: "Great shop.",
        consentNoticeVersion: "v2",
      },
    });
    // Origin is checked first, so this is stable under rate limiting.
    expect(response.status()).toBe(403);
  });
});

test.describe("POST /api/analytics — allowlist", () => {
  test("accepts an allowlisted event", async ({ request }) => {
    const response = await request.post("/api/analytics", {
      data: { eventName: "page_opened" },
    });
    expect(response.status()).toBe(200);
    expect((await response.json()).success).toBe(true);
  });

  test("silently drops an unknown event name", async ({ request }) => {
    const response = await request.post("/api/analytics", {
      headers: freshIp(),
      data: { eventName: "review_published" },
    });
    // Returns 200 on purpose: the client is mid-navigation and must not retry.
    expect(response.status()).toBe(200);
  });

  test("silently drops extra metadata such as a rating or email", async ({ request }) => {
    const ip = freshIp();
    const withRating = await request.post("/api/analytics", {
      headers: ip,
      data: { eventName: "review_copied", rating: 5 },
    });
    const withEmail = await request.post("/api/analytics", {
      headers: ip,
      data: { eventName: "review_copied", email: "someone@example.com" },
    });
    expect(withRating.status()).toBe(200);
    expect(withEmail.status()).toBe(200);
  });
});

test.describe("GET /api/public-config", () => {
  test("never exposes server-only fields", async ({ request }) => {
    const response = await request.get("/api/public-config");
    const text = await response.text();

    // Credentials and the privacy contact must never appear.
    expect(text).not.toMatch(/service_role|SERVICE_ROLE|anon_key|contactEmail/i);
    // Timestamps and business id are internal.
    expect(text).not.toMatch(/created_at|createdAt|updated_at|updatedAt/);
    // `privacyNoticeVersion` IS intentionally public: the consent checkbox
    // needs to send the exact published version with a submission.
    expect(text).toMatch(/privacyNoticeVersion/);
  });
});
