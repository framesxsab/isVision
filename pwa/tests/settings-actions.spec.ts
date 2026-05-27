// Coverage for the two action buttons added to Settings during the software-
// completeness sweep: "Cache language tables" under Offline readiness, and
// "Clear saved data" under Privacy.

import { test, expect, type Page } from "@playwright/test";

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

test.describe("Settings action buttons", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("Clear saved data wipes the tactile store and surfaces a status", async ({ page }) => {
    // Seed a non-default state we can prove the button wiped.
    await page.addInitScript(() => {
      localStorage.setItem(
        "isvisible-tactile",
        JSON.stringify({
          state: { translatorMode: "g2", language: "fr-g2", drillDifficulty: "hard" },
          version: 2,
        })
      );
    });

    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await page.getByTestId("clear-local-data").click();
    // Status line is wired to aria-live="polite" so the success message is
    // announced. We just assert it renders something.
    await expect(page.locator("text=Cleared imported text")).toBeVisible();

    // After the wipe the tactile store key should reflect defaults; we
    // open it via evaluate to inspect what landed.
    const post = await page.evaluate(() => {
      const raw = localStorage.getItem("isvisible-tactile");
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        translatorMode: parsed?.state?.translatorMode,
        language: parsed?.state?.language,
        drillDifficulty: parsed?.state?.drillDifficulty,
      };
    });
    expect(post?.translatorMode).toBe("g1");
    expect(post?.language).toBe("en-g2");
    expect(post?.drillDifficulty).toBe("normal");
  });

  test("Cache language tables button is visible and renders a hint", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const button = page.getByRole("button", {
      name: "Pre-fetch language tables so they're available offline",
    });
    await expect(button).toBeVisible();
    // We don't actually click — that would fire the Liblouis worker, which
    // needs the precache + assets to be served. The Playwright preview
    // server has them, but the test would be slow and flaky. Existence +
    // a11y name is enough for this layer.
  });
});
