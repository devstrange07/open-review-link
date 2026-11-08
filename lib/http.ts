import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { firstIssueMessage } from "@/lib/validation";

/**
 * One error shape for every API route:
 *   { success: false, error: { code, message } }
 *
 * Codes are stable and safe for the client to branch on. Messages are always
 * safe to show a customer — no provider errors, stack traces, or DB text.
 */

export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  BAD_REQUEST: "BAD_REQUEST",
  UNSUPPORTED_MEDIA_TYPE: "UNSUPPORTED_MEDIA_TYPE",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  FORBIDDEN_ORIGIN: "FORBIDDEN_ORIGIN",
  RATE_LIMITED: "RATE_LIMITED",
  UNAUTHENTICATED: "UNAUTHENTICATED",
  NOT_ADMIN: "NOT_ADMIN",
  NOT_FOUND: "NOT_FOUND",
  AI_PROVIDER_ERROR: "AI_PROVIDER_ERROR",
  AI_INVALID_OUTPUT: "AI_INVALID_OUTPUT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  BAD_REQUEST: 400,
  UNSUPPORTED_MEDIA_TYPE: 415,
  PAYLOAD_TOO_LARGE: 413,
  FORBIDDEN_ORIGIN: 403,
  RATE_LIMITED: 429,
  UNAUTHENTICATED: 401,
  NOT_ADMIN: 403,
  NOT_FOUND: 404,
  AI_PROVIDER_ERROR: 502,
  AI_INVALID_OUTPUT: 502,
  INTERNAL_ERROR: 500,
};

const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  VALIDATION_ERROR: "Please check the details and try again.",
  BAD_REQUEST: "That request could not be understood.",
  UNSUPPORTED_MEDIA_TYPE: "Unsupported request format.",
  PAYLOAD_TOO_LARGE: "That request was too large.",
  FORBIDDEN_ORIGIN: "This request did not come from the shop page.",
  RATE_LIMITED: "Too many attempts. Please wait a moment and try again.",
  UNAUTHENTICATED: "Please sign in.",
  NOT_ADMIN: "This account does not have admin access.",
  NOT_FOUND: "Not found.",
  AI_PROVIDER_ERROR: "Review generation is temporarily unavailable.",
  AI_INVALID_OUTPUT: "We could not generate a review from that text. Please try again.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
};

export function apiError(
  code: ErrorCode,
  message?: string,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message: message ?? DEFAULT_MESSAGE[code] } },
    { status: STATUS_BY_CODE[code], headers },
  );
}

export function apiOk<T extends object>(
  body: T,
  headers?: Record<string, string>,
): NextResponse {
  return NextResponse.json({ success: true, ...body }, { headers });
}

/** Max request body. The largest legitimate payload is 1.5k of feedback. */
export const MAX_BODY_BYTES = 16 * 1024;

export type BodyResult =
  { ok: true; data: unknown } | { ok: false; response: NextResponse };

/**
 * Read and parse a JSON body with content-type and size enforcement.
 * Checks Content-Length first (cheap reject) and the actual bytes second,
 * because Content-Length can be absent or lie on chunked requests.
 */
export async function readJsonBody(request: Request): Promise<BodyResult> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return { ok: false, response: apiError(ERROR_CODES.UNSUPPORTED_MEDIA_TYPE) };
  }

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false, response: apiError(ERROR_CODES.PAYLOAD_TOO_LARGE) };
  }

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { ok: false, response: apiError(ERROR_CODES.BAD_REQUEST) };
  }

  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
    return { ok: false, response: apiError(ERROR_CODES.PAYLOAD_TOO_LARGE) };
  }

  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch {
    return { ok: false, response: apiError(ERROR_CODES.BAD_REQUEST) };
  }
}

/**
 * Reject cross-site writes.
 *
 * `Origin` is present on all cross-site form and fetch POSTs in current
 * browsers. `Sec-Fetch-Site` is the fallback when Origin is stripped by a
 * proxy. Same-origin and `none` (direct navigation) are allowed; only a
 * positively-foreign origin is rejected, so an unusual but benign client
 * isn't locked out.
 */
export function isSameOrigin(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) {
    // No Origin and no cross-site signal: not a browser cross-site write.
    return true;
  }

  const allowed = new Set<string>();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      allowed.add(new URL(appUrl).origin);
    } catch {
      // Invalid config is surfaced elsewhere; don't fail closed on it here.
    }
  }
  // Behind a proxy the request URL reflects the public host.
  try {
    allowed.add(new URL(request.url).origin);
  } catch {
    // Non-absolute request URL (rare). Fall through to the Origin comparison.
  }

  return allowed.has(origin);
}

export function guardOrigin(request: Request): NextResponse | null {
  return isSameOrigin(request) ? null : apiError(ERROR_CODES.FORBIDDEN_ORIGIN);
}

/**
 * Convert anything thrown inside a route into the standard envelope.
 * Provider and database details stay in the server log, never in the response.
 */
export function toErrorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof ZodError) {
    return apiError(ERROR_CODES.VALIDATION_ERROR, firstIssueMessage(error));
  }
  console.error(`[${context}]`, error instanceof Error ? error.name : "unknown error");
  return apiError(ERROR_CODES.INTERNAL_ERROR);
}

/** Best-effort client identity for rate limiting. Never stored or returned. */
export function clientFingerprint(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}
