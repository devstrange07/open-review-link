import type { Metadata } from "next";
import Link from "next/link";
import { getBusinessSettings } from "@/lib/settings";
import { buildBrandPalette } from "@/lib/color";

export const metadata: Metadata = {
  title: "Privacy notice",
  description: "How this shop handles the feedback you share.",
};

/**
 * Rendered per request, for two independent reasons:
 *
 *   1. The notice must show the shop's *live* contact details. Static generation
 *      would bake in whatever the DB held at build time — or, worse, the
 *      "not configured" fallback if the build ran without secrets.
 *   2. proxy.ts issues a fresh CSP nonce per response, and a statically
 *      prerendered page has no nonce in its inline scripts. With
 *      `script-src 'nonce-…' 'strict-dynamic'` the browser ignores `'self'` for
 *      scripts, so a static page would fail its own CSP and render blank.
 */
export const dynamic = "force-dynamic";

/**
 * Privacy notice.
 *
 * Everything here must be true of the actual implementation — this page is the
 * disclosure the consent checkbox points at, so an inaccurate statement is a
 * correctness bug, not a copy problem.
 *
 * Content is derived from the DB where possible (shop name, contact, notice
 * version) so it cannot drift out of sync with what the customer agreed to.
 */
export default async function PrivacyPage() {
  let settings;
  try {
    settings = await getBusinessSettings();
  } catch {
    settings = null;
  }

  const palette = buildBrandPalette(settings?.primaryColor);
  const shopName = settings?.name ?? "this shop";
  const version = settings?.privacyNoticeVersion ?? "v1";

  return (
    <div
      style={
        {
          "--brand": palette.brand,
          "--brand-ink": palette.ink,
          "--brand-soft": palette.soft,
        } as React.CSSProperties
      }
      className="min-h-screen-safe"
    >
      <main
        id="main"
        className="pb-safe-lg mx-auto w-full max-w-xl px-5 pt-8 text-[0.9375rem] leading-relaxed"
      >
        <h1 className="text-2xl font-semibold tracking-tight">Privacy notice</h1>
        <p className="mt-1 text-xs text-[color:var(--text-muted)]">
          Version {version} · Applies to the feedback page for {shopName}
        </p>

        <div className="mt-7 space-y-6 text-pretty">
          <section>
            <h2 className="text-base font-semibold">What we don&rsquo;t collect</h2>
            <p className="mt-1.5 text-[color:var(--text-muted)]">
              No account, name, email address, phone number, Google account, or device
              fingerprint is required or stored. There is nothing to sign up for.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Your rating</h2>
            <p className="mt-1.5 text-[color:var(--text-muted)]">
              Selecting a star rating records an anonymous count so the shop can see how
              it is doing overall. It is not linked to you or to anything you write.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Your written feedback</h2>
            <p className="mt-1.5 text-[color:var(--text-muted)]">
              When you write feedback and ask us to help with a review, that feedback is
              shared privately with {shopName}. It is never published publicly, and it is
              only ever used by the business to improve the service. Each submission
              records which version of this notice you were shown. Your feedback is kept
              for up to 180 days and then deleted automatically. You can ask us to delete
              it sooner using the contact details below.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">AI-assisted drafting</h2>
            <p className="mt-1.5 text-[color:var(--text-muted)]">
              If you ask us to help write a review, the text you typed and your star
              rating are sent to a third-party AI provider (Google Gemini) to produce a
              draft. They are used only to generate that draft. The draft is returned to
              your browser and is not saved by this website.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">Google reviews</h2>
            <p className="mt-1.5 text-[color:var(--text-muted)]">
              Posting a review on Google is entirely your choice and happens on
              Google&rsquo;s own site under your own account. This website only copies
              your text to your clipboard and opens Google in a new tab. We cannot see
              whether you posted, and we do not receive a copy of what Google stores.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold">How long we keep it</h2>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[color:var(--text-muted)]">
              <li>Private feedback: up to 180 days, then deleted automatically.</li>
              <li>Anonymous usage counts: up to 90 days.</li>
              <li>Generated review drafts: never stored.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold">Contact</h2>
            {settings ? (
              <p className="mt-1.5 text-[color:var(--text-muted)]">
                Questions about this notice or a request to delete feedback you shared:{" "}
                <a
                  href={`mailto:${settings.contactEmail}`}
                  className="font-medium text-[color:var(--brand-ink)] underline underline-offset-2"
                >
                  {settings.contactEmail}
                </a>
                {settings.contactAddress ? (
                  <>
                    <br />
                    <span className="whitespace-pre-line">{settings.contactAddress}</span>
                  </>
                ) : null}
              </p>
            ) : (
              <p className="mt-1.5 text-[color:var(--text-muted)]">
                Contact details are not configured for this deployment yet.
              </p>
            )}
          </section>
        </div>

        <div className="mt-8 border-t border-[color:var(--border)] pt-5">
          <Link
            href={settings ? `/r/${settings.slug}` : "/"}
            className="text-sm font-medium text-[color:var(--brand-ink)] underline-offset-4 hover:underline"
          >
            Back to the feedback page
          </Link>
        </div>
      </main>
    </div>
  );
}
