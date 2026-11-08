import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge-of-app request handling (the file convention formerly called
 * `middleware`). Two jobs, in this order:
 *
 *   1. Refresh the Supabase session so auth cookies don't expire mid-visit.
 *   2. Attach a nonce-based Content-Security-Policy.
 *
 * The nonce approach costs us static rendering: every page becomes dynamic
 * because each response needs a fresh nonce. At this traffic level that is a
 * fair price for removing `unsafe-inline` from script-src, which is the single
 * highest-value CSP directive.
 */

/**
 * `upgrade-insecure-requests` is only correct when the page itself arrives over
 * TLS. Serving a production build over plain HTTP (local E2E, a staging box
 * behind a proxy) while emitting it is actively harmful: WebKit upgrades
 * loopback subresources to https://127.0.0.1, they fail to connect, and the
 * page never hydrates. Chrome exempts loopback and hides the bug.
 */
function isSecureRequest(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() === "https";
  }
  return request.nextUrl.protocol === "https:";
}

function buildCsp(nonce: string, isDev: boolean, isSecure: boolean): string {
  const supabaseOrigin = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
    } catch {
      return "";
    }
  })();

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Next injects inline bootstrap scripts; they inherit our nonce. Turbopack
    // in dev also needs eval for HMR.
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    // Next emits inline <style> for critical CSS; hashing those is brittle and
    // style injection is a far lower risk than script injection.
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    // Supabase auth calls come from the browser.
    "connect-src": ["'self'", supabaseOrigin, ...(isDev ? ["ws:", "wss:"] : [])].filter(
      Boolean,
    ),
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "worker-src": ["'self'", "blob:"],
    "manifest-src": ["'self'"],
  };

  if (!isDev && isSecure) directives["upgrade-insecure-requests"] = [];

  return Object.entries(directives)
    .map(([name, values]) => (values.length ? `${name} ${values.join(" ")}` : name))
    .join("; ");
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV !== "production";
  const isSecure = isSecureRequest(request);

  // Next reads the nonce back off the request's CSP header and applies it to
  // the scripts it renders, so this must be set before the response is built.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", buildCsp(nonce, isDev, isSecure));

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Session refresh only matters for the admin area, and skipping public pages
  // keeps the customer flow free of an auth round trip.
  const needsSessionRefresh = request.nextUrl.pathname.startsWith("/admin");

  if (needsSessionRefresh && supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: requestHeaders } });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    });

    // Must be called: this is what triggers the refresh and the cookie write.
    // Ignore the result — authorization happens in the route/layout, not here.
    await supabase.auth.getUser();
  }

  const csp = buildCsp(nonce, isDev, isSecure);
  response.headers.set("content-security-policy", csp);

  // Admin responses must never be cached by a shared proxy.
  if (request.nextUrl.pathname.startsWith("/admin")) {
    response.headers.set("cache-control", "private, no-store");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation, which never need
     * a nonce and would pay the cost for nothing.
     */
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
