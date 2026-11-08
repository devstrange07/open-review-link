"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary.
 *
 * Shown when a Server Component throws. Deliberately does not display the error
 * message: it can contain internal detail, and no customer can act on it. The
 * digest is shown in small print so a staff member can quote it to support.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the digest only. Error messages from server code may include data.
    console.error("[route-error]", error.digest ?? "no-digest");
  }, [error]);

  return (
    <main
      id="main"
      className="min-h-screen-safe mx-auto flex max-w-md flex-col items-center justify-center px-6 text-center"
    >
      <h1 className="text-xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-2 text-[0.9375rem] leading-relaxed text-pretty text-[color:var(--text-muted)]">
        The page couldn&rsquo;t load. Your text is still in this browser tab &mdash; try
        again before leaving.
      </p>

      <button
        type="button"
        onClick={reset}
        className="pressable mt-6 inline-flex min-h-11 items-center rounded-xl bg-[color:var(--brand)] px-5 text-sm font-medium text-[color:var(--on-brand)]"
      >
        Try again
      </button>

      {error.digest ? (
        <p className="mt-6 text-xs text-[color:var(--text-muted)]">
          Reference: <span className="tabular">{error.digest}</span>
        </p>
      ) : null}
    </main>
  );
}
