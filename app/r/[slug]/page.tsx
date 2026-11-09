import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBusinessSettings, toPublicConfig } from "@/lib/settings";
import { buildBrandPalette } from "@/lib/color";
import { FeedbackFlow } from "@/components/customer/feedback-flow";

/**
 * The QR landing page.
 *
 * The shop's configuration is read on the server and passed down as props, so
 * the first paint has real content — no loading skeleton, no client fetch, no
 * flash of empty stars. That is the single biggest perceived-performance win
 * available on this page.
 *
 * `force-dynamic` is deliberate: proxy.ts issues a fresh CSP nonce per response,
 * and an admin's Google-URL edit must be live on the next scan rather than after
 * a cache window. At one query per scan this is cheap.
 */

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const settings = await getBusinessSettings();
    if (!settings || settings.slug !== slug) {
      return { title: "Not found" };
    }
    return {
      title: settings.welcomeTitle,
      description: settings.welcomeMessage,
      alternates: { canonical: `/r/${settings.slug}` },
    };
  } catch {
    return { title: "Not found" };
  }
}

export default async function ShopPage({ params }: PageProps) {
  const { slug } = await params;

  let settings;
  try {
    settings = await getBusinessSettings();
  } catch (error) {
    // Env not configured, or the DB is unreachable. Log the reason so a
    // misconfigured deployment is diagnosable, but show the customer a calm
    // setup notice rather than a stack trace: this page is on a printed QR code.
    console.error(
      "[shop] could not load settings:",
      error instanceof Error ? error.message.split("\n")[0] : "unknown",
    );
    return <SetupNeeded />;
  }

  if (!settings) return <SetupNeeded />;
  if (settings.slug !== slug) notFound();

  const palette = buildBrandPalette(settings.primaryColor);
  const config = toPublicConfig(settings);

  return (
    <div
      className="qr-page"
      style={
        {
          "--brand": palette.brand,
          "--brand-ink": palette.ink,
          "--brand-soft": palette.soft,
          "--on-brand": palette.onBrand,
          backgroundColor: "var(--surface-muted)",
        } as React.CSSProperties
      }
    >
      <FeedbackFlow shop={config} />
    </div>
  );
}

/**
 * What a customer sees if the deployment is not configured yet. Deliberately
 * calm and non-technical: the person holding the phone cannot fix this, and
 * telling them about environment variables would be noise.
 */
function SetupNeeded() {
  return (
    <main
      id="main"
      className="min-h-screen-safe mx-auto flex max-w-md flex-col items-center justify-center px-6 text-center"
    >
      <h1 className="text-xl font-semibold tracking-tight">
        This page isn&rsquo;t ready yet
      </h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-pretty text-[color:var(--text-muted)]">
        The shop hasn&rsquo;t finished setting up its feedback page. Please try again
        later, or let the staff know.
      </p>
    </main>
  );
}
