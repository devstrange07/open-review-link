"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/shared/button";
import { InlineMessage } from "@/components/shared/inline-message";
import type { BusinessSettings } from "@/lib/settings";

/**
 * Shop settings form.
 *
 * Client-side validation mirrors the server schema but does not replace it —
 * the PATCH route re-validates everything. The form's job is to fail fast and
 * explain, not to be the gate.
 *
 * Slug is displayed read-only with an explicit warning. It is baked into printed
 * QR codes, so it is deliberately not editable here.
 */

type Props = { settings: BusinessSettings };

const GOOGLE_HOST_HINT =
  "This doesn't look like a Google review link. Double-check it opens your shop's review form.";

function looksLikeGoogle(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      host.endsWith("google.com") ||
      host.endsWith("google.co.in") ||
      host === "g.page" ||
      host.endsWith("goo.gl") ||
      host.endsWith("maps.app.goo.gl")
    );
  } catch {
    return true;
  }
}

export function SettingsForm({ settings }: Props) {
  const router = useRouter();

  const [name, setName] = useState(settings.name);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [welcomeTitle, setWelcomeTitle] = useState(settings.welcomeTitle);
  const [welcomeMessage, setWelcomeMessage] = useState(settings.welcomeMessage);
  const [googleReviewUrl, setGoogleReviewUrl] = useState(settings.googleReviewUrl);
  const [contactEmail, setContactEmail] = useState(settings.contactEmail);
  const [contactAddress, setContactAddress] = useState(settings.contactAddress ?? "");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const googleWarning =
    googleReviewUrl.startsWith("https://") && !looksLikeGoogle(googleReviewUrl)
      ? GOOGLE_HOST_HINT
      : null;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          logoUrl,
          primaryColor,
          welcomeTitle,
          welcomeMessage,
          googleReviewUrl,
          contactEmail,
          contactAddress,
        }),
      });

      const payload: unknown = await response.json().catch(() => null);
      const parsed = payload as
        { success: true } | { success: false; error: { message: string } } | null;

      if (!response.ok || !parsed || parsed.success !== true) {
        setError(
          parsed && parsed.success === false
            ? parsed.error.message
            : "Could not save changes. Please try again.",
        );
        return;
      }

      setSaved(true);
      // The customer page reads through a tag cache that the PATCH route
      // invalidates; refresh so this admin sees the new values reflected.
      router.refresh();
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <fieldset className="space-y-4 rounded-xl border border-[color:var(--border)] bg-white p-4">
        <legend className="px-1 text-sm font-semibold">Shop identity</legend>

        <Field label="Shop name" htmlFor="name">
          <input
            id="name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            maxLength={80}
            className="field"
          />
        </Field>

        <Field
          label="Logo URL"
          htmlFor="logoUrl"
          hint="HTTPS only. Leave empty to show a default icon. A square image around 112px works best."
        >
          <input
            id="logoUrl"
            type="url"
            inputMode="url"
            value={logoUrl}
            onChange={(event) => setLogoUrl(event.target.value)}
            placeholder="https://example.com/logo.png"
            className="field"
          />
        </Field>

        <Field
          label="Brand colour"
          htmlFor="primaryColor"
          hint="Used for stars and buttons. A darker colour keeps button text readable."
        >
          <div className="flex items-center gap-2">
            <input
              id="primaryColor"
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(primaryColor) ? primaryColor : "#245C47"}
              onChange={(event) => setPrimaryColor(event.target.value.toUpperCase())}
              aria-label="Pick brand colour"
              className="size-11 shrink-0 cursor-pointer rounded-lg border border-[color:var(--border)] bg-white p-1"
            />
            <input
              value={primaryColor}
              onChange={(event) => setPrimaryColor(event.target.value)}
              required
              maxLength={7}
              aria-label="Brand colour hex value"
              className="field tabular"
            />
          </div>
        </Field>

        <Field
          label="Slug"
          htmlFor="slug"
          hint="Printed on the QR code — contact a developer to change it."
        >
          <input
            id="slug"
            value={settings.slug}
            readOnly
            aria-describedby="slug-warning"
            className="field cursor-not-allowed bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]"
          />
          <p id="slug-warning" className="mt-1 text-xs text-[color:var(--text-muted)]">
            Changing this would break every QR code already in circulation.
          </p>
        </Field>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-[color:var(--border)] bg-white p-4">
        <legend className="px-1 text-sm font-semibold">Customer-facing copy</legend>

        <Field label="Welcome heading" htmlFor="welcomeTitle">
          <input
            id="welcomeTitle"
            value={welcomeTitle}
            onChange={(event) => setWelcomeTitle(event.target.value)}
            required
            maxLength={80}
            className="field"
          />
        </Field>

        <Field label="Welcome message" htmlFor="welcomeMessage">
          <textarea
            id="welcomeMessage"
            value={welcomeMessage}
            onChange={(event) => setWelcomeMessage(event.target.value)}
            required
            maxLength={200}
            rows={3}
            className="field resize-none"
          />
        </Field>
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-[color:var(--border)] bg-white p-4">
        <legend className="px-1 text-sm font-semibold">Google review</legend>

        <Field
          label="Google review URL"
          htmlFor="googleReviewUrl"
          hint="Where the customer lands after copying their review. HTTPS required."
        >
          <input
            id="googleReviewUrl"
            type="url"
            inputMode="url"
            value={googleReviewUrl}
            onChange={(event) => setGoogleReviewUrl(event.target.value)}
            required
            placeholder="https://g.page/r/…/review"
            aria-describedby={googleWarning ? "google-warning" : undefined}
            className="field"
          />
        </Field>

        {googleWarning ? (
          <p
            id="google-warning"
            className="rounded-lg px-3 py-2 text-xs leading-relaxed"
            style={{
              backgroundColor: "var(--danger-soft)",
              color: "var(--danger)",
            }}
          >
            {googleWarning} You can still save it.
          </p>
        ) : null}
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-[color:var(--border)] bg-white p-4">
        <legend className="px-1 text-sm font-semibold">Privacy contact</legend>
        <p className="-mt-1 text-xs leading-relaxed text-[color:var(--text-muted)]">
          Shown on the privacy notice so customers know who to contact about their data.
        </p>

        <Field label="Contact email" htmlFor="contactEmail">
          <input
            id="contactEmail"
            type="email"
            inputMode="email"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            required
            maxLength={120}
            className="field"
          />
        </Field>

        <Field
          label="Contact address"
          htmlFor="contactAddress"
          hint="Optional. Printed on the privacy notice if provided."
        >
          <textarea
            id="contactAddress"
            value={contactAddress}
            onChange={(event) => setContactAddress(event.target.value)}
            maxLength={200}
            rows={2}
            className="field resize-none"
          />
        </Field>

        <Field
          label="Privacy notice version"
          htmlFor="privacyVersion"
          hint="Bump this only when the notice materially changes; every stored feedback row records the version it was given under."
        >
          <input
            id="privacyVersion"
            value={settings.privacyNoticeVersion}
            readOnly
            className="field cursor-not-allowed bg-[color:var(--surface-muted)] text-[color:var(--text-muted)]"
          />
        </Field>
      </fieldset>

      {error ? <InlineMessage tone="error">{error}</InlineMessage> : null}
      {saved && !error ? (
        <InlineMessage tone="success">
          Saved. The customer page now uses these values.
        </InlineMessage>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving} loadingLabel="Saving">
          {saving ? "Saving" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      {children}
      {hint ? (
        <p className="mt-1 text-xs leading-relaxed text-pretty text-[color:var(--text-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
