import { test, expect } from "@playwright/test";

/**
 * Rate limiting, proven rather than assumed.
 *
 * This spec deliberately exhausts a budget. It is kept separate from the
 * contract tests because a spent budget there would look like a validation
 * failure, and because these assertions are about *rejection*, which is the
 * only interesting property of a limiter.
 *
 * Budgets (lib/rate-limit.ts):
 *   reviewDraft  8 / 5 min
 *   feedback     6 / 10 min
 *   analytics   60 / 1 min
 *
 * All requests share one IP in this environment, which is exactly the shape of
 * a single abusive caller.
 */

test.describe("review-draft rate limit", () => {
  // This spec needs a budget it owns completely. If it shared an IP with the
  // contract tests, the first burst here would starve them and they would have
  // to skip — which is exactly the coverage hole this suite is closing.
  const ip = { "x-forwarded-for": "203.0.113.42" };

  test("eventually rejects with 429 and a retry-after header", async ({ request }) => {
    let sawRejection = false;

    // The budget is 8; probe up to 30 so this passes whether the bucket is
    // fresh or partially spent by an earlier spec.
    for (let i = 0; i < 30; i += 1) {
      const response = await request.post("/api/review-draft", {
        headers: ip,
        data: { rating: 5, feedbackText: "Staff were helpful and the shop was clean." },
      });

      if (response.status() === 429) {
        sawRejection = true;

        const body = await response.json();
        expect(body.success).toBe(false);
        expect(body.error.code).toBe("RATE_LIMITED");

        const retryAfter = response.headers()["retry-after"];
        expect(retryAfter, "a retry-after header should be present").toBeTruthy();
        expect(Number(retryAfter)).toBeGreaterThan(0);

        break;
      }

      // Anything other than "allowed through to the provider, which then
      // failed" means the request never reached the limiter properly.
      expect([200, 502]).toContain(response.status());
    }

    expect(sawRejection, "the limiter should block a sustained burst").toBe(true);
  });

  test("the rejection message is friendly, not technical", async ({ request }) => {
    // Ensure we are in the limited state.
    for (let i = 0; i < 30; i += 1) {
      const probe = await request.post("/api/review-draft", {
        headers: ip,
        data: { rating: 4, feedbackText: "A reasonable place to shop." },
      });
      if (probe.status() === 429) break;
    }

    const blocked = await request.post("/api/review-draft", {
      headers: ip,
      data: { rating: 4, feedbackText: "A reasonable place to shop." },
    });

    expect(blocked.status(), "the budget should be exhausted by the probe loop").toBe(
      429,
    );

    const text = await blocked.text();
    expect(text).not.toMatch(/redis|upstash|limit:\s*\d+|instance|stack/i);
    expect(text).toMatch(/please wait/i);
  });
});

test.describe("analytics rate limit is generous", () => {
  test("does not block a realistic burst of page events", async ({ request }) => {
    // A real customer fires at most a handful of these per visit. Ten in a row
    // must never be blocked, or we would lose legitimate data.
    for (let i = 0; i < 10; i += 1) {
      const response = await request.post("/api/analytics", {
        data: { eventName: "page_opened" },
      });
      expect(response.status()).toBe(200);
    }
  });
});
