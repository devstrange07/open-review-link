import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { hasRedisEnv } from "@/lib/env";
import { clientFingerprint } from "@/lib/http";

/**
 * Rate limiting.
 *
 * Upstash when configured. When it is absent or the network call fails, the
 * limiter degrades *open* — a customer trying to leave a review must never be
 * blocked because our cache is unreachable. Every degraded decision is logged
 * once per process so the failure is visible without flooding the logs.
 *
 * Tradeoff, stated plainly: on serverless hosting an in-memory fallback is
 * per-instance and therefore only a speed bump, not a real limit. It still
 * stops a single warm instance from being hammered in a loop.
 */

type Limiter = {
  limit: (identifier: string) => Promise<{ success: boolean; reset?: number }>;
};

let degradedLogged = false;

function logDegraded(reason: string) {
  if (degradedLogged) return;
  degradedLogged = true;
  console.warn(`[rate-limit] running degraded: ${reason}`);
}

/** Sliding window: `tokens` requests per `windowSeconds` per key. */
function createUpstashLimiter(tokens: number, windowSeconds: number): Limiter {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, `${windowSeconds} s`),
    analytics: false,
    prefix: `qrfb:${tokens}:${windowSeconds}`,
  });
  return {
    async limit(identifier) {
      const result = await limiter.limit(identifier);
      return { success: result.success, reset: result.reset };
    },
  };
}

/** Fixed-window counter in process memory. Best effort, per instance. */
function createMemoryLimiter(tokens: number, windowSeconds: number): Limiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  const windowMs = windowSeconds * 1000;
  const MAX_KEYS = 5_000;

  return {
    async limit(identifier) {
      const now = Date.now();
      if (buckets.size > MAX_KEYS) {
        for (const [key, bucket] of buckets) {
          if (bucket.resetAt <= now) buckets.delete(key);
        }
        // Still oversized after pruning: drop the oldest entries.
        if (buckets.size > MAX_KEYS) {
          const excess = buckets.size - MAX_KEYS;
          let removed = 0;
          for (const key of buckets.keys()) {
            buckets.delete(key);
            if (++removed >= excess) break;
          }
        }
      }

      const existing = buckets.get(identifier);
      if (!existing || existing.resetAt <= now) {
        buckets.set(identifier, { count: 1, resetAt: now + windowMs });
        return { success: true, reset: now + windowMs };
      }
      existing.count += 1;
      return {
        success: existing.count <= tokens,
        reset: existing.resetAt,
      };
    },
  };
}

const limiters = new Map<string, Limiter>();

function getLimiter(name: string, tokens: number, windowSeconds: number): Limiter {
  const cached = limiters.get(name);
  if (cached) return cached;
  const limiter = hasRedisEnv()
    ? createUpstashLimiter(tokens, windowSeconds)
    : createMemoryLimiter(tokens, windowSeconds);
  limiters.set(name, limiter);
  return limiter;
}

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

/** Per-customer budgets. Deliberately generous — this is not a paywall. */
export const RATE_LIMITS = {
  reviewDraft: { name: "review-draft", tokens: 8, windowSeconds: 300 },
  feedback: { name: "feedback", tokens: 6, windowSeconds: 600 },
  analytics: { name: "analytics", tokens: 60, windowSeconds: 60 },
  adminLogin: { name: "admin-login", tokens: 8, windowSeconds: 300 },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

export async function checkRateLimit(
  name: RateLimitName,
  request: Request,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[name];
  const limiter = getLimiter(config.name, config.tokens, config.windowSeconds);
  const identifier = `${config.name}:${clientFingerprint(request)}`;

  try {
    const result = await limiter.limit(identifier);
    if (result.success) return { allowed: true };
    const retryAfterSeconds = result.reset
      ? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
      : config.windowSeconds;
    return { allowed: false, retryAfterSeconds };
  } catch {
    logDegraded("limiter threw");
    return { allowed: true };
  }
}

/** Test-only hook so suites can start from a clean slate. */
export function resetLimitersForTests(): void {
  limiters.clear();
  degradedLogged = false;
}
