import "server-only";
import { cache } from "react";
import { BUSINESS_ID } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export type BusinessSettings = {
  id: number;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  welcomeTitle: string;
  welcomeMessage: string;
  googleReviewUrl: string;
  privacyNoticeVersion: string;
  contactEmail: string;
  contactAddress: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = {
  id: number;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  welcome_title: string;
  welcome_message: string;
  google_review_url: string;
  privacy_notice_version: string;
  contact_email: string;
  contact_address: string | null;
  created_at: string;
  updated_at: string;
};

function mapRow(row: Row): BusinessSettings {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    primaryColor: row.primary_color,
    welcomeTitle: row.welcome_title,
    welcomeMessage: row.welcome_message,
    googleReviewUrl: row.google_review_url,
    privacyNoticeVersion: row.privacy_notice_version,
    contactEmail: row.contact_email,
    contactAddress: row.contact_address,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_COLUMNS =
  "id,name,slug,logo_url,primary_color,welcome_title,welcome_message,google_review_url,privacy_notice_version,contact_email,contact_address,created_at,updated_at";

/**
 * Read the single business row.
 *
 * Wrapped in React `cache` so the layout, the page, and the metadata generator
 * in one render share a single query. Revalidation is tag-based: the settings
 * PATCH handler calls `revalidateTag("business-settings")`.
 *
 * Returns null when the row is missing so callers can render a clear setup
 * error instead of crashing a customer's page with a stack trace.
 */
export const getBusinessSettings = cache(async (): Promise<BusinessSettings | null> => {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("business_settings")
    .select(SELECT_COLUMNS)
    .eq("id", BUSINESS_ID)
    .maybeSingle<Row>();

  if (error) {
    console.error("[settings] read failed", error.code);
    return null;
  }
  return data ? mapRow(data) : null;
});

/** Public projection. Adding a column here is the only way it reaches the browser. */
export type PublicShopConfig = Pick<
  BusinessSettings,
  | "name"
  | "slug"
  | "logoUrl"
  | "primaryColor"
  | "welcomeTitle"
  | "welcomeMessage"
  | "googleReviewUrl"
  | "privacyNoticeVersion"
>;

export function toPublicConfig(settings: BusinessSettings): PublicShopConfig {
  return {
    name: settings.name,
    slug: settings.slug,
    logoUrl: settings.logoUrl,
    primaryColor: settings.primaryColor,
    welcomeTitle: settings.welcomeTitle,
    welcomeMessage: settings.welcomeMessage,
    googleReviewUrl: settings.googleReviewUrl,
    privacyNoticeVersion: settings.privacyNoticeVersion,
  };
}

export async function getSettingsBySlug(slug: string): Promise<BusinessSettings | null> {
  const settings = await getBusinessSettings();
  if (!settings || settings.slug !== slug) return null;
  return settings;
}
