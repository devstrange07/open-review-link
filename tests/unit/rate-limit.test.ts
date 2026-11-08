import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkRateLimit, resetLimitersForTests, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * The fallback path is what runs in CI and in any deployment without Upstash,
 * so its behaviour matters more than the happy path being pretty.
 */

function makeRequest(ip: string): Request {
  return new Request("https://example.com/api/test", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
  });
}

beforeEach(() => {
  resetLimitersForTests();
  vi.unstubAllEnvs();
});

describe("checkRateLimit — in-memory fallback", () => {
  beforeEach(() => {
    // No Upstash env, so the memory limiter is selected.
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });

  it("allows requests up to the configured budget", async () => {
    const ip = "203.0.113.10";
    const budget = RATE_LIMITS.analytics.tokens;

    for (let i = 0; i < budget; i += 1) {
      const result = await checkRateLimit("analytics", makeRequest(ip));
      expect(result.allowed, `request ${i + 1} of ${budget}`).toBe(true);
    }
  });

  it("blocks the request after the budget is exhausted", async () => {
    const ip = "203.0.113.11";
    const budget = RATE_LIMITS.analytics.tokens;

    for (let i = 0; i < budget; i += 1) {
      await checkRateLimit("analytics", makeRequest(ip));
    }

    const blocked = await checkRateLimit("analytics", makeRequest(ip));
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks different IPs independently", async () => {
    const budget = RATE_LIMITS.analytics.tokens;

    for (let i = 0; i < budget; i += 1) {
      await checkRateLimit("analytics", makeRequest("198.51.100.1"));
    }

    const otherIp = await checkRateLimit("analytics", makeRequest("198.51.100.2"));
    expect(otherIp.allowed).toBe(true);
  });

  it("tracks different limits independently", async () => {
    const draftBudget = RATE_LIMITS.reviewDraft.tokens;
    for (let i = 0; i < draftBudget; i += 1) {
      await checkRateLimit("reviewDraft", makeRequest("198.51.100.9"));
    }

    // The feedback limiter is a separate bucket for the same caller.
    const feedback = await checkRateLimit("feedback", makeRequest("198.51.100.9"));
    expect(feedback.allowed).toBe(true);
  });

  it("uses the first address in a multi-hop X-Forwarded-For", async () => {
    const request = new Request("https://example.com/api/test", {
      method: "POST",
      headers: { "x-forwarded-for": "198.51.100.5, 70.41.3.18, 150.172.238.178" },
    });
    const budget = RATE_LIMITS.analytics.tokens;

    for (let i = 0; i < budget; i += 1) {
      await checkRateLimit("analytics", request);
    }

    // Same first hop, so the next call shares the bucket and is blocked.
    const blocked = await checkRateLimit("analytics", request);
    expect(blocked.allowed).toBe(false);
  });

  it("falls back to a shared bucket when no address is present", async () => {
    const bare = new Request("https://example.com/api/test", { method: "POST" });
    const budget = RATE_LIMITS.analytics.tokens;

    for (let i = 0; i < budget; i += 1) {
      await checkRateLimit("analytics", bare);
    }
    expect((await checkRateLimit("analytics", bare)).allowed).toBe(false);
  });

  it("never throws, even with an unusable request", async () => {
    const weird = new Request("https://example.com/api/test", {
      method: "POST",
      headers: { "x-forwarded-for": "" },
    });
    await expect(checkRateLimit("analytics", weird)).resolves.toBeDefined();
  });
});

describe("checkRateLimit — degradation", () => {
  it("fails open when the configured limiter throws", async () => {
    // Point Upstash at an unroutable host so the client rejects.
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://127.0.0.1:1");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "dummy-token-value");

    const result = await checkRateLimit("reviewDraft", makeRequest("192.0.2.55"));

    // Customer must never be blocked because our cache is unreachable.
    expect(result.allowed).toBe(true);
  });
});

describe("rate limit budgets", () => {
  it("keeps the AI budget tighter than analytics", () => {
    expect(RATE_LIMITS.reviewDraft.tokens).toBeLessThan(RATE_LIMITS.analytics.tokens);
  });

  it("gives every limit a positive window", () => {
    for (const config of Object.values(RATE_LIMITS)) {
      expect(config.tokens).toBeGreaterThan(0);
      expect(config.windowSeconds).toBeGreaterThan(0);
    }
  });
});
