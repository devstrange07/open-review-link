import type { Metadata } from "next";
import { getBusinessSettings } from "@/lib/settings";
import { buildBrandPalette } from "@/lib/color";
import { PrivacyPageClient } from "@/components/customer/privacy-page-client";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How this shop handles the feedback you share.",
};

/**
 * Rendered per request so contact details stay live and CSP nonces work.
 */
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  let settings;
  try {
    settings = await getBusinessSettings();
  } catch {
    settings = null;
  }

  const palette = buildBrandPalette(settings?.primaryColor);
  const shopName = settings?.name ?? "this shop";
  const version = settings?.privacyNoticeVersion ?? "v2";

  return (
    <div
      style={
        {
          "--brand": palette.brand,
          "--brand-ink": palette.ink,
          "--brand-soft": palette.soft,
        } as React.CSSProperties
      }
    >
      <PrivacyPageClient
        shopName={shopName}
        version={version}
        slug={settings?.slug ?? null}
        contactEmail={settings?.contactEmail ?? null}
        contactAddress={settings?.contactAddress ?? null}
      />
    </div>
  );
}
