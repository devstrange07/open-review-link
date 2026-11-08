import QRCode from "qrcode";
import { requireAdmin } from "@/lib/auth";
import { getBusinessSettings } from "@/lib/settings";
import { apiError, ERROR_CODES } from "@/lib/http";
import { getServerEnv } from "@/lib/env";

/**
 * GET /api/admin/qr?format=svg|png&size=1024
 *
 * Generates the shop QR server-side from NEXT_PUBLIC_APP_URL. Admin-only: the
 * URL itself is public, but keeping this behind auth means the endpoint isn't a
 * free image-generation service.
 *
 * Error correction level M balances print robustness against module density —
 * at 1024px it survives a slightly scuffed counter sticker.
 */
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (auth.status === "unauthenticated") return apiError(ERROR_CODES.UNAUTHENTICATED);
  if (auth.status === "not_admin") return apiError(ERROR_CODES.NOT_ADMIN);

  const settings = await getBusinessSettings();
  if (!settings) return apiError(ERROR_CODES.NOT_FOUND, "Shop configuration not found.");

  let appUrl: string;
  try {
    appUrl = getServerEnv().NEXT_PUBLIC_APP_URL;
  } catch {
    return apiError(ERROR_CODES.INTERNAL_ERROR, "App URL is not configured.");
  }

  const target = `${appUrl.replace(/\/$/, "")}/r/${settings.slug}`;
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "png" ? "png" : "svg";

  const requestedSize = Number(url.searchParams.get("size") ?? "1024");
  const size = Number.isFinite(requestedSize)
    ? Math.min(2048, Math.max(256, Math.round(requestedSize)))
    : 1024;

  const options = {
    errorCorrectionLevel: "M" as const,
    margin: 2,
    color: {
      // Pure black on pure white. Anything prettier scans worse, and this code
      // is going to be printed on a sticker at the counter.
      dark: "#000000",
      light: "#FFFFFF",
    },
  };

  try {
    if (format === "png") {
      const buffer = await QRCode.toBuffer(target, {
        ...options,
        type: "png",
        width: size,
      });
      return new Response(new Uint8Array(buffer), {
        headers: {
          "content-type": "image/png",
          "cache-control": "private, max-age=300",
          "content-disposition": `inline; filename="qr-${settings.slug}.png"`,
        },
      });
    }

    const svg = await QRCode.toString(target, { ...options, type: "svg", width: size });
    return new Response(svg, {
      headers: {
        "content-type": "image/svg+xml; charset=utf-8",
        "cache-control": "private, max-age=300",
        // An inline SVG is a document; lock it down even though it is generated.
        "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      },
    });
  } catch {
    console.error("[qr] generation failed");
    return apiError(ERROR_CODES.INTERNAL_ERROR, "Could not generate the QR code.");
  }
}
