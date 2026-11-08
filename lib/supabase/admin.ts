import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses RLS by design.
 *
 * Guarded three ways:
 *   1. `server-only` — importing this from a client component is a build error.
 *   2. The key lives in a non-public env var, so it is not inlined into bundles.
 *   3. Only route handlers and server components import it; nothing here is
 *      reachable from a form the browser can shape.
 *
 * Never pass a value from the request into this client without validating it first.
 */
export function createAdminClient() {
  const env = getServerEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export type AdminClient = ReturnType<typeof createAdminClient>;
