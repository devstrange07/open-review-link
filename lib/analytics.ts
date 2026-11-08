import "server-only";
import { ANALYTICS_EVENTS, type AnalyticsEventName } from "@/lib/validation";
import { BUSINESS_ID } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED = new Set<string>(ANALYTICS_EVENTS);

/**
 * Record an anonymous usage event.
 *
 * Deliberately swallows failures: analytics must never surface an error to a
 * customer or make a page feel broken. The only stored data is an allowlisted
 * event name, the fixed business id, and a server-generated timestamp.
 */
export async function recordEvent(eventName: AnalyticsEventName): Promise<void> {
  if (!ALLOWED.has(eventName)) {
    console.warn("[analytics] rejected non-allowlisted event");
    return;
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("analytics_events")
      .insert({ business_id: BUSINESS_ID, event_name: eventName });

    if (error) console.error("[analytics] insert failed", error.code);
  } catch {
    console.error("[analytics] insert threw");
  }
}
