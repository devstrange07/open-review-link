import { test, expect, type Page } from "@playwright/test";

/**
 * The customer journey.
 *
 * Gated on E2E_SHOP_SLUG because the flow needs a real business_settings row.
 *
 *   E2E_SHOP_SLUG=shop npm run test:e2e
 *
 * Mutating APIs are stubbed so the suite never writes to a real database.
 */

const SLUG = process.env.E2E_SHOP_SLUG ?? "shop";
const SHOP_PATH = `/r/${SLUG}`;

async function gotoShop(page: Page) {
  await page.goto(SHOP_PATH);
  await expect(page.locator("[data-hydrated]")).toHaveAttribute("data-hydrated", "true");
}

async function expectFeedbackStep(page: Page) {
  await expect(
    page.getByRole("heading", { name: /what could we improve/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^continue$/i })).toBeVisible();
}

async function expectChoicesStep(page: Page) {
  await expect(
    page.getByRole("heading", { name: /leave a public review/i }),
  ).toBeVisible();
}

function starRadio(page: Page, n: number) {
  return page.getByRole("radio", { name: new RegExp(`${n} star`, "i") });
}

test.describe("customer journey", () => {
  test.beforeEach(async ({ page }) => {
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
        body: JSON.stringify({
          success: true,
          message: "Feedback received.",
          reference: "qrfb_e2e_test_reference",
        }),
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

  test("skip path finishes without writing or AI", async ({ page }) => {
    let reviewDraftCalls = 0;
    await page.route("**/api/review-draft", async (route) => {
      reviewDraftCalls += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, reviewText: "unused", language: "en" }),
      });
    });

    await gotoShop(page);
    await starRadio(page, 5).click();
    await expectFeedbackStep(page);

    await page.getByRole("button", { name: /^skip$/i }).click();
    await expectChoicesStep(page);
    await page.getByRole("button", { name: /finish without a public review/i }).click();

    await expect(page.getByRole("heading", { name: /thank you/i })).toBeVisible();
    await expect(page.getByText("qrfb_e2e_test_reference")).toBeVisible();
    expect(reviewDraftCalls).toBe(0);
  });

  test("full path: rate, topics, AI draft, copy, thank-you", async ({ page }) => {
    await gotoShop(page);

    await expect(starRadio(page, 5)).toHaveAttribute("aria-checked", "false");
    await starRadio(page, 5).click();
    await expectFeedbackStep(page);

    await page.getByRole("button", { name: /staff assistance/i }).click();
    await page
      .getByLabel(/tell us a little more/i)
      .fill("Staff were helpful and the product quality was good.");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await expectChoicesStep(page);

    await page.getByRole("button", { name: /help me write a review/i }).click();

    const review = page.getByLabel(/your review is ready/i);
    await expect(review).toBeVisible();
    await expect(review).toHaveValue(/helpful/i);

    await review.fill("Edited: friendly staff, good quality.");

    const isWebKit = test.info().project.name === "mobile-ios";
    if (isWebKit) {
      const popup = page.waitForEvent("popup");
      await page.getByRole("button", { name: /copy & open google/i }).click();
      await expect(
        page
          .locator('div[role="status"]')
          .filter({ hasText: /review copied|blocked clipboard access|could not copy/i }),
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

    await expect(page.getByRole("heading", { name: /thank you/i })).toBeVisible();
  });

  test("Google is reachable without rating or generating anything", async ({ page }) => {
    await gotoShop(page);

    const googleLink = page.getByRole("link", { name: /leave a google review/i });
    await expect(googleLink).toBeVisible();
    const href = await googleLink.getAttribute("href");
    expect(href).toMatch(/^https:\/\//);
    await expect(googleLink).toHaveAttribute("target", "_blank");
  });

  test("a 1-star rating still gets Google access and recovery", async ({ page }) => {
    await gotoShop(page);

    await starRadio(page, 1).click();
    await expectFeedbackStep(page);
    await expect(page.getByRole("link", { name: /leave a google review/i })).toBeVisible();

    await page.getByRole("button", { name: /^skip$/i }).click();
    await expect(
      page.getByRole("heading", { name: /would you like us to follow up/i }),
    ).toBeVisible();

    await page.getByRole("button", { name: /no thanks/i }).click();
    await expectChoicesStep(page);
    await expect(page.getByRole("link", { name: /leave a google review/i })).toBeVisible();
  });

  test("recovery requires consent before accepting a phone", async ({ page }) => {
    await gotoShop(page);
    await starRadio(page, 2).click();
    await expectFeedbackStep(page);
    await page.getByRole("button", { name: /^continue$/i }).click();

    await page.getByLabel(/phone number/i).fill("9876543210");
    await page.getByRole("button", { name: /request a follow-up/i }).click();
    await expect(page.getByText(/confirm we may contact you/i)).toBeVisible();

    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: /request a follow-up/i }).click();
    await expectChoicesStep(page);
  });

  test("stars are keyboard operable", async ({ page }) => {
    await gotoShop(page);

    const five = starRadio(page, 5);
    await five.focus();
    await five.press("ArrowLeft");
    await expect(starRadio(page, 4)).toHaveAttribute("aria-checked", "true");

    await starRadio(page, 4).press("Home");
    await expect(starRadio(page, 1)).toHaveAttribute("aria-checked", "true");

    await starRadio(page, 1).press("End");
    await expect(starRadio(page, 5)).toHaveAttribute("aria-checked", "true");
  });

  test("topic chips enable AI without typing", async ({ page }) => {
    await gotoShop(page);
    await starRadio(page, 5).click();
    await expectFeedbackStep(page);

    await page.getByRole("button", { name: /^continue$/i }).click();
    await expectChoicesStep(page);

    const help = page.getByRole("button", { name: /help me write a review/i });
    await expect(help).toHaveAttribute("aria-disabled", "true");

    await page.evaluate(() => history.back());
    await expectFeedbackStep(page);

    const chip = page.getByRole("button", { name: /staff assistance/i });
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^continue$/i }).click();
    await expectChoicesStep(page);
    await expect(help).not.toHaveAttribute("aria-disabled", "true");
  });

  test("locale switcher changes visible journey copy", async ({ page }) => {
    await gotoShop(page);
    await expect(page.getByText(/how was your experience/i)).toBeVisible();

    await page.locator("#locale-select").selectOption("hi");
    await expect(page.getByText(/हमारे साथ आपका अनुभव/i)).toBeVisible();

    await page.locator("#locale-select").selectOption("gu");
    await expect(page.getByText(/અમારી સાથે તમારો અનુભવ/i)).toBeVisible();
  });

  test("AI failure keeps Google available on choices", async ({ page }) => {
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
    await starRadio(page, 4).click();
    await expectFeedbackStep(page);
    await page.getByRole("button", { name: /product availability/i }).click();
    await page.getByRole("button", { name: /^continue$/i }).click();
    await expectChoicesStep(page);

    await page.getByRole("button", { name: /help me write a review/i }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: /temporarily unavailable/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /leave a google review/i })).toBeVisible();
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
