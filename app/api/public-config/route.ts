import { getBusinessSettings, toPublicConfig } from "@/lib/settings";
import { apiError, apiOk, ERROR_CODES } from "@/lib/http";

/**
 * Public shop configuration.
 *
 * Exposes only the `toPublicConfig` projection — the privacy contact, timestamps
 * and anything added to the table later stay server-side unless it is explicitly
 * added to that projection.
 */
export async function GET() {
  let settings;
  try {
    settings = await getBusinessSettings();
  } catch {
    return apiError(ERROR_CODES.INTERNAL_ERROR);
  }

  if (!settings) return apiError(ERROR_CODES.NOT_FOUND, "Shop configuration not found.");

  return apiOk(toPublicConfig(settings), {
    // Short cache: config changes are rare, but an admin who just fixed the
    // Google URL should see it reflected without waiting an hour.
    "cache-control": "public, max-age=0, s-maxage=60, stale-while-revalidate=300",
  });
}
