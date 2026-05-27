// Playwright coverage for the Tactile Lab language selector. We assert the
// UI wire-up (selector appears when Grade 2 is active, hides when Grade 1) —
// we don't wait for a real Liblouis translation here because the WASM build
// is ~1.6 MB and we don't want this test to depend on network shape.

import { test, expect, type Page } from "@playwright/test";

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

test.describe("Tactile Lab language selector", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");
  });

  test("the language radiogroup is hidden in Grade 1 mode", async ({ page }) => {
    // Default is Grade 1 debug.
    await expect(page.getByRole("button", { name: "Grade 1 (debug)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(page.getByRole("radiogroup", { name: "Liblouis braille language" })).toHaveCount(
      0
    );
  });

  test("the language radiogroup shows three languages when Grade 2 is picked", async ({ page }) => {
    await page.getByRole("button", { name: "Grade 2 (Liblouis)" }).click();
    const group = page.getByRole("radiogroup", { name: "Liblouis braille language" });
    await expect(group).toBeVisible();
    await expect(group.getByRole("radio", { name: "English UEB" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await expect(group.getByRole("radio", { name: "Français" })).toBeVisible();
    await expect(group.getByRole("radio", { name: "Deutsch" })).toBeVisible();
  });

  test("clicking another language flips aria-checked", async ({ page }) => {
    await page.getByRole("button", { name: "Grade 2 (Liblouis)" }).click();
    const fr = page.getByRole("radio", { name: "Français" });
    await fr.click();
    await expect(fr).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio", { name: "English UEB" })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });
});
