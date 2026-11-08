"use client";

import { useState } from "react";
import { Download } from "lucide-react";

/**
 * QR panel.
 *
 * The QR image is rendered server-side at /api/admin/qr so the customer's
 * printed link never depends on client JS. This panel just previews it and
 * offers the PNG download.
 *
 * Deliberately no live QR generation in the browser: one source of truth for the
 * image means the printed code and the downloaded file can never disagree.
 */
export function QrPanel({ shopUrl, shopName }: { shopUrl: string; shopName: string }) {
  // Record which URL failed rather than a bare boolean, so changing the URL
  // clears the error without an effect that resets state on a prop change.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = failedUrl !== null && failedUrl === shopUrl;

  if (!shopUrl) {
    return (
      <div className="rounded-xl border border-[color:var(--border)] bg-white p-4">
        <h2 className="text-sm font-semibold tracking-tight">QR code</h2>
        <p className="mt-2 text-xs leading-relaxed text-[color:var(--text-muted)]">
          Set <code>NEXT_PUBLIC_APP_URL</code> to generate a QR code. The code must point
          at your public domain, not localhost.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-white p-4">
      <h2 className="text-sm font-semibold tracking-tight">QR code</h2>
      <p className="mt-1 text-xs leading-relaxed text-pretty text-[color:var(--text-muted)]">
        Print this at the counter. It points at your own domain, so the Google link can
        change later without reprinting.
      </p>

      <div className="mt-3 rounded-lg border border-[color:var(--border)] bg-white p-3">
        {failed ? (
          <p className="py-10 text-center text-xs text-[color:var(--text-muted)]">
            Could not load the QR image. Try the download link below.
          </p>
        ) : (
          // Server-rendered SVG from our own route handler. next/image refuses
          // SVG by default (dangerouslyAllowSVG) and cannot optimize a vector,
          // so it would only add a proxy hop here.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/api/admin/qr?format=svg"
            alt={`QR code linking to the feedback page for ${shopName}`}
            width={280}
            height={280}
            className="mx-auto block h-auto w-full max-w-[280px]"
            onError={() => setFailedUrl(shopUrl)}
          />
        )}
      </div>

      <p className="mt-2 text-[0.6875rem] leading-relaxed break-all text-[color:var(--text-muted)]">
        {shopUrl}
      </p>

      <a
        href="/api/admin/qr?format=png&size=1024"
        download={`${shopName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-qr.png`}
        className="pressable mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[color:var(--border)] px-3 text-[0.8125rem] font-medium hover:border-[color:var(--text-muted)]"
      >
        <Download aria-hidden="true" className="size-4" />
        Download PNG (1024px)
      </a>
    </div>
  );
}
