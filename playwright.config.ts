import { defineConfig, devices } from "@playwright/test";

/**
 * E2E config.
 *
 * Runs against a production build on phone-sized viewports, because the
 * customer experience is the product and desktop Chrome hides exactly the bugs
 * that matter (tap targets, safe-area padding, iOS zoom, back-gesture behaviour).
 *
 * Two fixtures make the suite hermetic and free:
 *   - tests/fixtures/mock-supabase.mjs stands in for the Supabase REST API, so
 *     the customer page renders real shop data without a database.
 *   - /api/review-draft is stubbed per-spec, so no Gemini quota is consumed and
 *     assertions are deterministic.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],

  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "mobile-android",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "mobile-ios",
      use: { ...devices["iPhone 13"] },
    },
    {
      name: "desktop-chrome",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: [
    {
      // Fixture API. Port is fixed and only used by the unconfigured-env specs
      // when the main webServer is not running against it.
      command: "node tests/fixtures/mock-supabase.mjs 54321",
      url: "http://127.0.0.1:54321/rest/v1/business_settings",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      // Build against the fixture API so the seeded shop renders. These are
      // placeholders, not secrets, and never reach a real service.
      command: "npm run build && npm run start -- --port 3100",
      url: "http://127.0.0.1:3100",
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
      env: {
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-anon-key-placeholder-0000000000",
        SUPABASE_SERVICE_ROLE_KEY: "e2e-service-role-placeholder-0000000",
        GEMINI_API_KEY: "e2e-gemini-placeholder",
        AI_MODEL: "gemini-2.5-flash",
        AI_FALLBACK_MODEL: "gemini-2.5-flash-lite",
        // Empty on purpose: the suite must never dial NVIDIA. An absent key
        // makes the provider chain Google-only, which is what these tests
        // exercise (and /api/review-draft is stubbed anyway).
        NVIDIA_API_KEY: "",
        NVIDIA_MODEL: "",
        NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3100",
        // Never hit a real Redis from tests.
        UPSTASH_REDIS_REST_URL: "",
        UPSTASH_REDIS_REST_TOKEN: "",
        E2E_FIXTURE: "1",
        E2E_SHOP_SLUG: "shop",
      },
    },
  ],
});
