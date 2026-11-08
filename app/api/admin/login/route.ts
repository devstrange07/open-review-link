import { createServerSupabaseClient } from "@/lib/supabase/server";
import { apiError, apiOk, ERROR_CODES, guardOrigin } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";

/**
 * POST /api/admin/login
 *
 * Rate limited per IP because this is the only credential entry point.
 * The error message never distinguishes "wrong password" from "no such user" —
 * that difference is a user-enumeration oracle.
 */
export async function POST(request: Request) {
  const originError = guardOrigin(request);
  if (originError) return originError;

  const rate = await checkRateLimit("adminLogin", request);
  if (!rate.allowed) {
    return apiError(
      ERROR_CODES.RATE_LIMITED,
      "Too many sign-in attempts. Please wait a few minutes.",
      { "retry-after": String(rate.retryAfterSeconds ?? 300) },
    );
  }

  let email: unknown;
  let password: unknown;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") throw new Error("bad body");
    ({ email, password } = body as { email?: unknown; password?: unknown });
  } catch {
    return apiError(ERROR_CODES.BAD_REQUEST);
  }

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.includes("@") ||
    email.length > 200 ||
    password.length < 1 ||
    password.length > 200
  ) {
    return apiError(ERROR_CODES.VALIDATION_ERROR, "Enter your email and password.");
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately generic. Rate limiting is what slows repeated guessing.
    return apiError(ERROR_CODES.UNAUTHENTICATED, "Email or password is incorrect.");
  }

  return apiOk({}, { "cache-control": "private, no-store" });
}
