// End-to-end persistence: settings the user touches in the Tactile Lab and
// Tactile Drill should survive a page reload. These tests run in a real
// browser so they exercise the actual zustand-persist → window.localStorage
// path instead of stubbed storage.

import { test, expect, type Page } from "@playwright/test";

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

test.describe("Tactile Lab persistence", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("translator mode survives a reload", async ({ page }) => {
    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");

    // Default is Grade 1. Flip to Grade 2 and reload.
    await page.getByRole("button", { name: "Grade 2 (Liblouis)" }).click();
    await expect(page.getByRole("button", { name: "Grade 2 (Liblouis)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: "Grade 2 (Liblouis)" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  test("imported text from clipboard is restored on next visit", async ({
    page,
    context,
    browserName,
  }) => {
    if (browserName !== "webkit") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    }
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          readText: async () => "persisted clipboard text",
          writeText: async () => undefined,
        },
      });
    });

    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Paste text from clipboard" }).click();
    await expect(page.locator("#tactile-source")).toHaveValue("persisted clipboard text");

    // Navigate away and back — the imported text should still be there.
    await page.goto("/");
    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#tactile-source")).toHaveValue("persisted clipboard text");
  });

  test("frame size survives a reload", async ({ page }) => {
    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "4 cells" }).click();
    await expect(page.getByRole("button", { name: "4 cells" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("button", { name: "4 cells" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});

test.describe("Tactile Drill persistence", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("drill mode and speech mode survive a reload", async ({ page }) => {
    await page.goto("/tactile-drill");
    await page.waitForLoadState("networkidle");

    await page.getByRole("radio", { name: "Words" }).click();
    await page.getByRole("radio", { name: "Speech + tactile" }).click();

    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("radio", { name: "Words" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    await expect(page.getByRole("radio", { name: "Speech + tactile" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  test("score persists across reload and Reset clears it", async ({ page }) => {
    await page.goto("/tactile-drill");
    await page.waitForLoadState("networkidle");

    // Submit one wrong guess so attempts > 0; the accuracy chip in the
    // header is how the score reaches the DOM.
    await page.locator("#drill-input").fill("zzz");
    await page.locator("#drill-input").press("Enter");
    await expect(page.locator("[data-testid='accuracy-chip']")).toHaveText(/%/);

    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("[data-testid='accuracy-chip']")).toHaveText(/%/);

    await page.getByRole("button", { name: "Reset score" }).click();
    await expect(page.locator("[data-testid='accuracy-chip']")).toHaveText("");
  });
});
