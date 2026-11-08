import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main"
      className="min-h-screen-safe mx-auto flex max-w-md flex-col items-center justify-center px-6 text-center"
    >
      <p className="tabular text-xs font-medium tracking-wider text-[color:var(--text-muted)] uppercase">
        404
      </p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-pretty text-[color:var(--text-muted)]">
        This link doesn&rsquo;t point anywhere. If you scanned a QR code at the shop, ask
        the staff for the current one.
      </p>
      <Link
        href="/"
        className="pressable mt-6 inline-flex min-h-11 items-center rounded-xl border border-[color:var(--border)] bg-white px-5 text-sm font-medium"
      >
        Go to the feedback page
      </Link>
    </main>
  );
}
