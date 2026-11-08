import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServerEnv } from "@/lib/env";

/**
 * Request-scoped client that carries the caller's auth cookies.
 *
 * Used to answer "who is this?" — never for privileged reads. The session it
 * returns is still verified against the allowlist in `lib/auth.ts`, because a
 * valid Supabase session does not imply admin access.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const env = getServerEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component render, where cookies are read-only.
            // Session refresh is handled by proxy.ts, so this is safe to ignore.
          }
        },
      },
    },
  );
}
