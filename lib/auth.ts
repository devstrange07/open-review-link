import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Admin authorization.
 *
 * Two independent checks, both required:
 *   1. Is the session real?  -> Supabase `getUser()` validates the JWT with the
 *      auth server. Unlike `getSession()`, it cannot be spoofed by a forged cookie.
 *   2. Is this user an admin? -> their id must exist in `admin_users`.
 *
 * Check 2 is what the spec calls the allowlist. A valid account that is not in
 * that table is authenticated but NOT authorized, and is told so (403), not
 * silently bounced to the login screen.
 */

export type AdminIdentity = { userId: string; email: string | null };

export type AuthOutcome =
  | { status: "unauthenticated" }
  | { status: "not_admin"; userId: string }
  | { status: "authorized"; admin: AdminIdentity };

export const getAdminIdentity = cache(async (): Promise<AuthOutcome> => {
  // Fail closed on any infrastructure failure. If we cannot positively verify
  // the session and the allowlist, the answer is "not authorized" — never a
  // 500 that a caller might misread, and never an accidental grant.
  try {
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return { status: "unauthenticated" };

    const admin = createAdminClient();
    const { data: allowlisted, error: lookupError } = await admin
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle<{ user_id: string }>();

    if (lookupError) {
      // An inability to verify the allowlist must not authorize.
      console.error("[auth] allowlist lookup failed", lookupError.code);
      return { status: "not_admin", userId: user.id };
    }

    if (!allowlisted) return { status: "not_admin", userId: user.id };

    return {
      status: "authorized",
      admin: { userId: user.id, email: user.email ?? null },
    };
  } catch (error) {
    // Auth service unreachable, malformed env, or a cookie store that threw.
    // Distinguishing these for the caller would leak infrastructure detail.
    console.error(
      "[auth] verification failed",
      error instanceof Error ? error.name : "unknown",
    );
    return { status: "unauthenticated" };
  }
});

/** For API routes: returns the identity or null. Callers shape the response. */
export async function requireAdmin(): Promise<AuthOutcome> {
  return getAdminIdentity();
}
