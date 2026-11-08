import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBusinessSettings, getSettingsBySlug } from "@/lib/settings";
import { BUSINESS_ID } from "@/lib/env";
import { validateBrandColor } from "@/lib/color";
import {
  apiError,
  apiOk,
  ERROR_CODES,
  guardOrigin,
  readJsonBody,
  toErrorResponse,
} from "@/lib/http";
import { firstIssueMessage, settingsUpdateSchema } from "@/lib/validation";

/**
 * PATCH /api/admin/settings
 *
 * Updates the shop configuration. Mass-assignment defence is structural: the
 * Zod schema is `.strict()` and the update object is built field by field from
 * the parsed result — a client cannot add `id`, `slug`, `privacy_notice_version`
 * or any future column by including it in the body.
 *
 * Slug is intentionally not editable. It is printed on physical QR codes, so
 * changing it would silently break every existing code.
 */
export async function PATCH(request: Request) {
  const originError = guardOrigin(request);
  if (originError) return originError;

  const auth = await requireAdmin();
  if (auth.status === "unauthenticated") return apiError(ERROR_CODES.UNAUTHENTICATED);
  if (auth.status === "not_admin") return apiError(ERROR_CODES.NOT_ADMIN);

  const body = await readJsonBody(request);
  if (!body.ok) return body.response;

  try {
    const parsed = settingsUpdateSchema.safeParse(body.data);
    if (!parsed.success) {
      return apiError(ERROR_CODES.VALIDATION_ERROR, firstIssueMessage(parsed.error));
    }

    const input = parsed.data;

    const colourCheck = validateBrandColor(input.primaryColor);
    if (!colourCheck.ok) {
      return apiError(ERROR_CODES.VALIDATION_ERROR, colourCheck.reason);
    }

    // Guard the one invariant the DB also enforces, but with a clearer message.
    const existing = await getBusinessSettings();
    if (!existing)
      return apiError(ERROR_CODES.NOT_FOUND, "Shop configuration not found.");

    if (input.logoUrl && input.logoUrl !== "") {
      // Reject non-HTTPS or non-URL logo values; the schema covers the tail
      // cases but a clear message here is worth the extra branch.
      if (!input.logoUrl.startsWith("https://")) {
        return apiError(ERROR_CODES.VALIDATION_ERROR, "The logo URL must use https://");
      }
    }

    // Explicit field list. Nothing from the request body is spread in.
    const update = {
      name: input.name,
      logo_url: input.logoUrl === "" ? null : (input.logoUrl ?? null),
      primary_color: input.primaryColor,
      welcome_title: input.welcomeTitle,
      welcome_message: input.welcomeMessage,
      google_review_url: input.googleReviewUrl,
      contact_email: input.contactEmail,
      contact_address:
        input.contactAddress && input.contactAddress.trim() !== ""
          ? input.contactAddress.trim()
          : null,
    };

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("business_settings")
      .update(update)
      .eq("id", BUSINESS_ID);

    if (error) {
      console.error("[admin-settings] update failed", error.code);
      return apiError(ERROR_CODES.INTERNAL_ERROR);
    }

    // Customer pages are rendered per request (see `dynamic` on the shop route),
    // so a settings change is visible on the next scan without cache plumbing.

    const refreshed = await getSettingsBySlug(existing.slug);
    return apiOk({ settings: refreshed }, { "cache-control": "private, no-store" });
  } catch (error) {
    return toErrorResponse(error, "admin-settings");
  }
}
