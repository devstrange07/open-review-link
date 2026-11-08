import type { Metadata } from "next";
import { getAdminIdentity } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";
import { QrPanel } from "@/components/admin/qr-panel";

export const metadata: Metadata = { title: "Settings" };

export default async function AdminSettingsPage() {
  const auth = await getAdminIdentity();
  if (auth.status !== "authorized") return null;

  const settings = await getBusinessSettings();

  if (!settings) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="rounded-xl border border-[color:var(--border)] bg-white p-4 text-sm text-[color:var(--text-muted)]">
          No shop configuration row exists. Apply{" "}
          <code className="text-xs">supabase/seed.sql</code> to create it, then reload.
        </p>
      </div>
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const shopUrl = appUrl ? `${appUrl.replace(/\/$/, "")}/r/${settings.slug}` : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-0.5 text-[0.8125rem] text-[color:var(--text-muted)]">
          Changes appear on the customer page immediately. No redeploy needed.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <SettingsForm settings={settings} />

        <div className="lg:sticky lg:top-6">
          <QrPanel shopUrl={shopUrl} shopName={settings.name} />
        </div>
      </div>
    </div>
  );
}
