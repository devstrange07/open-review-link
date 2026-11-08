import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser client. Anon key only — RLS on the database is what actually
 * protects data, and every privileged write goes through a route handler.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
