import { redirect } from "next/navigation";
import { getBusinessSettings } from "@/lib/settings";

/**
 * Root redirect.
 *
 * The domain root is what people type, and what a QR code generator might be
 * pointed at by mistake. Rather than a dead page or a marketing placeholder,
 * send them to the live shop. Resolved from the DB so it keeps working when the
 * slug changes.
 *
 * `force-dynamic` because the slug must come from the live database: a static
 * prerender would bake in the build-time value (or a redirect to nothing).
 */
export const dynamic = "force-dynamic";

export default async function RootPage() {
  let slug: string | null = null;
  try {
    const settings = await getBusinessSettings();
    slug = settings?.slug ?? null;
  } catch {
    slug = null;
  }

  if (slug) redirect(`/r/${slug}`);

  return (
    <main
      id="main"
      className="min-h-screen-safe mx-auto flex max-w-md flex-col items-center justify-center px-6 text-center"
    >
      <h1 className="text-xl font-semibold tracking-tight">Not set up yet</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-pretty text-[color:var(--text-muted)]">
        This deployment has no shop configuration. An administrator needs to complete
        setup before the feedback page can open.
      </p>
      <a
        href="/admin/login"
        className="mt-6 text-sm font-medium text-[color:var(--brand-ink)] underline-offset-4 hover:underline"
      >
        Admin sign in
      </a>
    </main>
  );
}
