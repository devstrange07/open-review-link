"use client";

import { ANALYTICS_EVENTS, type AnalyticsEventName } from "@/lib/validation";

const ALLOWED = new Set<string>(ANALYTICS_EVENTS);

/**
 * Fire-and-forget analytics.
 *
 * Three deliberate properties:
 *   - `keepalive` so the request survives the navigation that immediately
 *     follows the Google link click (the page is unloading at that moment).
 *   - Failures are silent. Analytics must never produce a visible error, and
 *     must never be retried in a loop.
 *   - Only allowlisted names can be sent, so this helper cannot become a
 *     channel for arbitrary data even if a caller passes something odd.
 */
export function sendAnalyticsEvent(eventName: AnalyticsEventName): void {
  if (typeof window === "undefined") return;
  if (!ALLOWED.has(eventName)) return;

  try {
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventName }),
      keepalive: true,
    }).catch(() => {
      // Intentionally ignored.
    });
  } catch {
    // Intentionally ignored.
  }
}
