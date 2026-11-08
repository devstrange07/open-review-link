import { z } from "zod";

/**
 * Server-side environment contract.
 *
 * Imported only from server code (route handlers, server components, scripts).
 * The `server-only` guard is enforced by convention: this module is never
 * imported from a file carrying `"use client"`.
 *
 * Access happens through `getServerEnv()`, which parses lazily so that
 * `next build` can type-check and collect page data without real secrets.
 * The first actual request fails loudly if anything is missing.
 */

/**
 * A URL that must be HTTPS in production but may be plain HTTP for local
 * development and E2E fixtures. Loopback only — a real HTTP deployment would
 * be a genuine security problem, so it stays rejected.
 */
const webUrl = z
  .string()
  .trim()
  .url("must be a valid URL")
  .refine(
    (value) => {
      if (value.startsWith("https://")) return true;
      try {
        const { hostname } = new URL(value);
        return (
          value.startsWith("http://") &&
          (hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]")
        );
      } catch {
        return false;
      }
    },
    { message: "must use https:// (http:// is allowed only for localhost)" },
  );

/**
 * Treat an empty string as "not set".
 *
 * `.env` files routinely ship `KEY=` with no value, and a copied template
 * leaves those behind. Zod's `.default()` only fires on `undefined`, so without
 * this an empty `AI_MODEL=` would fail validation instead of using the default,
 * and an empty optional URL would fail `.url()` instead of being treated as
 * absent. This is the single most common way a fresh clone fails to boot.
 */
const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(emptyToUndefined, schema.optional());

const withDefault = <T extends z.ZodTypeAny>(schema: T, fallback: string) =>
  z.preprocess(emptyToUndefined, schema.default(fallback));

const required = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(emptyToUndefined, schema);

const serverEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: required(webUrl),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required(z.string().trim().min(20)),
  SUPABASE_SERVICE_ROLE_KEY: required(z.string().trim().min(20)),
  GEMINI_API_KEY: required(z.string().trim().min(10)),
  AI_MODEL: withDefault(z.string().trim().min(1), "gemini-2.5-flash"),
  // Used only when the primary model fails at the provider level (network, 429,
  // 5xx, retired name). A cheaper model keeps the draft working without letting
  // a single outage take the feature down.
  AI_FALLBACK_MODEL: withDefault(z.string().trim().min(1), "gemini-2.5-flash-lite"),
  // Optional NVIDIA primary. When the key is absent the provider chain is just
  // Google, so a deploy without an NVIDIA account still boots and drafts.
  // Blank counts as absent, matching the rest of this schema.
  NVIDIA_API_KEY: optional(z.string().trim().min(10)),
  // Multilingual models on NVIDIA's hosted endpoint are reasoning models: they
  // bill chain-of-thought to the same `max_tokens` budget as the answer, so the
  // adapter requests a large budget and reads only `message.content`.
  NVIDIA_MODEL: withDefault(
    z.string().trim().min(1),
    "nvidia/nemotron-3.5-lightning-30b-a3b",
  ),
  NEXT_PUBLIC_APP_URL: required(webUrl),
  UPSTASH_REDIS_REST_URL: optional(z.string().trim().url()),
  UPSTASH_REDIS_REST_TOKEN: optional(z.string().trim().min(10)),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration. Copy .env.example to .env.local and fill it in.\n${details}`,
    );
  }

  cached = parsed.data;
  return cached;
}

/**
 * True when an NVIDIA key is present.
 *
 * Read from `process.env` rather than the parsed cache so the provider chain can
 * be assembled without forcing a full env parse (and without throwing on a
 * partially configured machine that only ever runs unit tests).
 */
export function hasNvidiaEnv(): boolean {
  return Boolean(process.env.NVIDIA_API_KEY?.trim());
}

/** True when Upstash is configured. Rate limiting degrades open without it. */
export function hasRedisEnv(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

/**
 * Single-shop deployment: the business row is always id 1.
 * Kept as a constant so no request can ever influence which business is written.
 */
export const BUSINESS_ID = 1 as const;

/** Test-only hook. Never called from application code. */
export function resetEnvCache(): void {
  cached = null;
}
