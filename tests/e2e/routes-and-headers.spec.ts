import { test, expect } from "@playwright/test";

/**
 * Security-critical route behaviour.
 *
 * These run against any deployment, configured or not, because they exercise
 * the auth gate and header layer rather than shop data.
 */

test.describe("admin routes are protected", () => {
  test("unauthenticated visitors are redirected to the login page", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL(/\/admin\/login/);
    await expect(page.getByRole("heading", { name: /admin sign in/i })).toBeVisible();
  });

  test("feedback history is not reachable without a session", async ({ page }) => {
    await page.goto("/admin/feedback");
    await page.waitForURL(/\/admin\/login/);
  });

  test("settings is not reachable without a session", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.waitForURL(/\/admin\/login/);
  });

  test("admin APIs reject unauthenticated calls", async ({ request }) => {
    for (const path of ["/api/admin/overview", "/api/admin/feedback"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(401);

      const body = await response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  test("admin settings cannot be changed without a session", async ({ request }) => {
    const response = await request.patch("/api/admin/settings", {
      data: { name: "Hijacked" },
    });
    expect(response.status()).toBe(401);
  });

  test("the QR endpoint is not a public image service", async ({ request }) => {
    const response = await request.get("/api/admin/qr?format=png");
    expect(response.status()).toBe(401);
  });

  test("admin pages are marked noindex", async ({ page }) => {
    await page.goto("/admin/login");
    const robots = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(robots).toContain("noindex");
  });
});

test.describe("security headers", () => {
  test("a content security policy is present and nonce-based", async ({ request }) => {
    const response = await request.get("/privacy");
    const csp = response.headers()["content-security-policy"];

    expect(csp).toBeTruthy();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toMatch(/script-src [^;]*'nonce-/);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // The whole point of the nonce is that unsafe-inline never appears here.
    expect(csp).not.toMatch(/script-src[^;]*unsafe-inline/);
  });

  test("upgrade-insecure-requests is only sent over https", async ({ request }) => {
    // Regression: emitting this on a plain-HTTP origin breaks the page. WebKit
    // upgrades subresources to https://127.0.0.1, they fail to connect, and
    // React never hydrates — so every button on the page silently does nothing.
    // Chrome exempts loopback, so only the iOS project caught it.
    const csp = (await request.get("/privacy")).headers()["content-security-policy"];

    expect(csp).not.toContain("upgrade-insecure-requests");
  });

  test("the nonce differs between requests", async ({ request }) => {
    const first = await request.get("/privacy");
    const second = await request.get("/privacy");

    const extract = (header: string | undefined) =>
      /'nonce-([^']+)'/.exec(header ?? "")?.[1] ?? "";

    const a = extract(first.headers()["content-security-policy"]);
    const b = extract(second.headers()["content-security-policy"]);

    expect(a).toBeTruthy();
    expect(b).toBeTruthy();
    expect(a).not.toBe(b);
  });

  test("clickjacking and sniffing protections are set", async ({ request }) => {
    const headers = (await request.get("/privacy")).headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toContain("microphone=()");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
});

test.describe("not found", () => {
  test("an unknown path renders the 404 page", async ({ page }) => {
    const response = await page.goto("/this-path-does-not-exist");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: /page not found/i })).toBeVisible();
  });
});
