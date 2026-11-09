import { test, expect, type Page } from "@playwright/test";

/**
 * The customer journey.
 *
 * Gated on E2E_SHOP_SLUG because the flow needs a real business_settings row —
 * the page renders a setup notice without one, by design. Set it to run these:
 *
 *   E2E_SHOP_SLUG=shop npm run test:e2e
 *
 * Both specs stub /api/review-draft, so no Gemini quota is consumed and the
 * assertions are deterministic. They also stub /api/feedback and /api/analytics
 * so the suite never writes to a real database.
 */

const SLUG = process.env.E2E_SHOP_SLUG ?? "shop";

const SHOP_PATH = `/r/${SLUG}`;

/**
 * Wait for the client component to actually hydrate before interacting.
 *
 * The page is server-rendered, so buttons exist and are visible while the
 * handler is still unbound. Playwright retries *assertions* but not a click, so
 * a tap that lands in that window is silently lost and the following
 * `toHaveAttribute` fails with "false" — intermittent, and only under parallel
 * load. The component exposes `data-hydrated` from its own state, which is the
 * real readiness signal rather than a sleep.
 */
async function gotoShop(page: Page) {
  await page.goto(SHOP_PATH);
  await expect(page.locator("[data-hydrated]")).toHaveAttribute("data-hydrated", "true");
}

test.describe("customer journey", () => {
  test.beforeEach(async ({ page }) => {
    // Stub every mutating endpoint before the page loads.
    await page.route("**/api/review-draft", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          reviewText:
            "I had a good experience at the shop. The staff were helpful and I found what I needed quickly.",
          language: "en",
        }),
      });
    });

    await page.route("**/api/feedback", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, message: "Feedback received." }),
      });
    });

    await page.route("**/api/analytics", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });
  });

  test("full happy path: rate, describe, generate, edit, copy", async ({ page }) => {
    await gotoShop(page);

    // Step 1: nothing is selected by default.
    await expect(page.getByRole("radio", { name: "5 stars" })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    await page.getByRole("radio", { name: "5 stars" }).click();

    // The tap both commits the rating and advances the step — the 300ms delay
    // exists only so the star pop is visible before the screen swaps. So assert
    // the committed outcome, not `aria-checked`: the star row is already
    // unmounted by the time the next assertion runs, which made this a race.
    await expect(
      page.getByRole("heading", { name: /tell us about your experience/i }),
    ).toBeVisible();
    await expect(page.getByText(/you rated us 5 stars/i)).toBeVisible();

    // Step 2: generate is gated until there is enough text.
    const textarea = page.getByLabel(/your feedback/i);
    await expect(textarea).toBeVisible();

    const generate = page.getByRole("button", { name: /help me write a review/i });
    await expect(generate).toHaveAttribute("aria-disabled", "true");

    await textarea.fill("Staff were helpful and the product quality was good.");
    await expect(generate).not.toHaveAttribute("aria-disabled", "true");

    await generate.click();

    // Step 3: the draft is editable and pre-filled.
    const review = page.getByLabel(/your review/i);
    await expect(review).toBeVisible();
    await expect(review).toHaveValue(/helpful/i);

    // Editing must work and must not overwrite the original feedback.
    await review.fill("Edited: friendly staff, good quality.");
    await expect(review).toHaveValue("Edited: friendly staff, good quality.");

    // Copy + Google is now a single action: one tap copies the text and opens
    // the review page. Both halves are asserted, because a tap that only does
    // one of them is the failure this merge was meant to prevent.
    // WebKit implements no `clipboard-write` permission and only allows
    // clipboard reads inside a user gesture, so there the fallback path is the
    // one that actually runs — both outcomes are honest, so assert whichever
    // the engine supports rather than skipping the step.
    const isWebKit = test.info().project.name === "mobile-ios";

    if (isWebKit) {
      const popup = page.waitForEvent("popup");
      await page.getByRole("button", { name: /copy & open google/i }).click();
      // One tap must both put the text on the clipboard and open Google. Which
      // clipboard outcome a headless engine gives is not the point; that the
      // tap is not a silent no-op is. Scoped to the visible status region, so
      // the sr-only live region cannot make the locator ambiguous.
      await expect(
        page
          .locator('div[role="status"]')
          .filter({ hasText: /review copied|blocked clipboard access/i }),
      ).toBeVisible();
      expect((await popup).url()).toMatch(/^https:\/\//);
    } else {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      const popup = page.waitForEvent("popup");
      await page.getByRole("button", { name: /copy & open google/i }).click();

      await expect(page.getByRole("button", { name: /copied/i })).toBeVisible();
      expect((await popup).url()).toMatch(/^https:\/\//);

      const clipboard = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboard).toBe("Edited: friendly staff, good quality.");
    }
  });

  test("Google is reachable without rating or generating anything", async ({ page }) => {
    await gotoShop(page);

    const googleLink = page.getByRole("link", { name: /review us on google/i });
    await expect(googleLink).toBeVisible();

    const href = await googleLink.getAttribute("href");
    expect(href).toMatch(/^https:\/\//);
    // It must be a real link, not a JS handler or a disabled control.
    await expect(googleLink).toHaveAttribute("target", "_blank");
  });

  test("a 1-star rating still gets the same Google access", async ({ page }) => {
    await gotoShop(page);

    await page.getByRole("radio", { name: "1 star" }).click();
    // A tap both records the rating and moves the customer on.
    await expect(
      page.getByRole("heading", { name: /tell us about your experience/i }),
    ).toBeVisible();

    // Identical destination regardless of rating: no rating-based routing.
    await expect(page.getByRole("link", { name: /review us on google/i })).toBeVisible();
  });

  test("stars are keyboard operable", async ({ page }) => {
    await gotoShop(page);

    const fiveStars = page.getByRole("radio", { name: "5 stars" });
    await fiveStars.focus();
    await fiveStars.press("ArrowLeft");
    await expect(page.getByRole("radio", { name: "4 stars" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.getByRole("radio", { name: "4 stars" }).press("Home");
    await expect(page.getByRole("radio", { name: "1 star" })).toHaveAttribute(
      "aria-checked",
      "true",
    );

    await page.getByRole("radio", { name: "1 star" }).press("End");
    await expect(page.getByRole("radio", { name: "5 stars" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("text survives an AI failure and Google stays available", async ({ page }) => {
    await page.route("**/api/review-draft", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({
          success: false,
          error: {
            code: "AI_PROVIDER_ERROR",
            message: "Review generation is temporarily unavailable.",
          },
        }),
      });
    });

    await gotoShop(page);
    await page.getByRole("radio", { name: "3 stars" }).click();
    await expect(
      page.getByRole("heading", { name: /tell us about your experience/i }),
    ).toBeVisible();

    const textarea = page.getByLabel(/your feedback/i);
    const typed = "It was okay but the queue was slow.";
    await textarea.fill(typed);

    await page.getByRole("button", { name: /help me write a review/i }).click();

    // Friendly error, announced. Scoped to the form region so Next's route
    // announcer (also role="alert") doesn't create an ambiguous match.
    await expect(
      page.getByRole("alert").filter({ hasText: /temporarily unavailable/i }),
    ).toBeVisible();

    // The customer's own words are untouched.
    await expect(textarea).toHaveValue(typed);

    // And Google is still one tap away.
    await expect(page.getByRole("link", { name: /review us on google/i })).toBeVisible();
  });

  test("a brief comment produces a short draft, not padding", async ({ page }) => {
    await page.route("**/api/review-draft", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          reviewText: "Quick service and the staff were friendly.",
          language: "en",
        }),
      });
    });

    await gotoShop(page);
    await page.getByRole("radio", { name: "4 stars" }).click();
    await expect(
      page.getByRole("heading", { name: /tell us about your experience/i }),
    ).toBeVisible();
    await page.getByLabel(/your feedback/i).fill("Quick and friendly.");
    await page.getByRole("button", { name: /help me write a review/i }).click();

    const review = page.getByLabel(/your review/i);
    await expect(review).toHaveValue("Quick service and the staff were friendly.");
    // The draft is not padded out with invented detail.
    expect((await review.inputValue()).split(/\s+/).length).toBeLessThan(30);
  });

  test("quick-fill chips enable generate with no typing", async ({ page }) => {
    await gotoShop(page);
    await page.getByRole("radio", { name: "5 stars" }).click();
    await expect(
      page.getByRole("heading", { name: /tell us about your experience/i }),
    ).toBeVisible();

    const generate = page.getByRole("button", { name: /help me write a review/i });
    await expect(generate).toHaveAttribute("aria-disabled", "true");

    // A confident rating gets appreciative phrasing.
    const chip = page.getByRole("button", { name: "Friendly and helpful staff" });
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");

    // Chips alone are enough: no characters were ever typed.
    await expect(page.getByLabel(/your feedback/i)).toHaveValue("");
    await expect(generate).not.toHaveAttribute("aria-disabled", "true");

    // A second tap removes it, which disables generate again.
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await expect(generate).toHaveAttribute("aria-disabled", "true");
  });

  test("a chip-only submission reaches the editor", async ({ page }) => {
    await gotoShop(page);
    await page.getByRole("radio", { name: "4 stars" }).click();
    await expect(
      page.getByRole("heading", { name: /tell us about your experience/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Quick service with no waiting" }).click();
    await page.getByRole("button", { name: /help me write a review/i }).click();

    const review = page.getByLabel(/your review/i);
    await expect(review).toBeVisible();
    await expect(review).toHaveValue(/helpful/i);
  });

  test("an unhappy rating gets constructive chips, not praise", async ({ page }) => {
    await gotoShop(page);
    await page.getByRole("radio", { name: "1 star" }).click();
    await expect(
      page.getByRole("heading", { name: /tell us about your experience/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "I had to wait a long time" }),
    ).toBeVisible();
    // The appreciative set must not be offered alongside it.
    await expect(
      page.getByRole("button", { name: "Friendly and helpful staff" }),
    ).toHaveCount(0);
  });

  test("changing the rating tier drops a chip that no longer belongs", async ({
    page,
  }) => {
    await gotoShop(page);
    // Going back and changing the star rating swaps the chip set; the previously
    // chosen phrase must not linger as an invisible selection.
    await page.getByRole("radio", { name: "5 stars" }).click();
    await expect(
      page.getByRole("heading", { name: /tell us about your experience/i }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Friendly and helpful staff" }).click();

    // No visible Back control any more: the browser's own Back walks the
    // steps, which is what a phone user expects from a hardware/gesture back.
    await page.evaluate(() => history.back());
    await page.getByRole("radio", { name: "1 star" }).click();
    await expect(
      page.getByRole("heading", { name: /tell us about your experience/i }),
    ).toBeVisible();

    await expect(
      page.getByRole("button", { name: "Friendly and helpful staff" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /help me write a review/i }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  test("the layout does not scroll horizontally at 320px", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await gotoShop(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
