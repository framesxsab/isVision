// When a browser doesn't support Web Serial / WebHID / clipboard read, the
// Tactile Lab should disable the relevant control and surface a concrete
// next step instead of letting the click silently fail. These tests strip
// the API off `navigator` before page load and assert the UI degrades
// cleanly.

import { test, expect, type Page } from "@playwright/test";

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

async function stripCapability(page: Page, key: "serial" | "hid" | "clipboard") {
  // Run before the bundle evaluates so capability detectors see the
  // stripped navigator. Using delete-after-defineProperty handles cases
  // where Chromium has already populated the key.
  await page.addInitScript((stripKey) => {
    try {
      Object.defineProperty(navigator, stripKey, {
        value: undefined,
        configurable: true,
      });
    } catch {
      // If the property is non-configurable, fall back to overriding via
      // an inherited get returning undefined.
      Object.defineProperty(Object.getPrototypeOf(navigator), stripKey, {
        get: () => undefined,
        configurable: true,
      });
    }
  }, key);
}

test.describe("Tactile Lab capability degradation", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("Web Serial missing → Send (N) button is disabled with a Chromium hint", async ({
    page,
  }) => {
    await stripCapability(page, "serial");
    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");

    const send = page.getByRole("button", { name: /Send \(N\)/ });
    await expect(send).toBeDisabled();
    const hint = page.locator("#serial-hint");
    await expect(hint).toContainText(/Web Serial is not available/);
    await expect(hint).toContainText(/Chromium/);
  });

  test("WebHID missing → Send to HID disabled with reason + suggestion", async ({ page }) => {
    await stripCapability(page, "hid");
    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");

    const send = page.getByRole("button", { name: /Send to a connected HID braille display/ });
    await expect(send).toBeDisabled();
    const hint = page.locator("#hid-hint");
    await expect(hint).toContainText(/WebHID is not available/);
  });

  test("Clipboard read missing → Paste button is disabled", async ({ page }) => {
    await stripCapability(page, "clipboard");
    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");

    const paste = page.getByRole("button", { name: /Paste from clipboard unavailable/ });
    await expect(paste).toBeDisabled();
  });

  test("Liblouis script 404 → Retry button is surfaced after the fallback", async ({ page }) => {
    // Block the script the adapter pulls in lazily; the worker can't boot
    // without it, so translateWithTable rejects and the page sets
    // translatorError. The Retry button must show up.
    await page.route("**/liblouis/easy-api.js", (route) => route.fulfill({ status: 404 }));

    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Grade 2 (Liblouis)" }).click();

    const retry = page.getByRole("button", { name: "Retry the Liblouis translation" });
    await expect(retry).toBeVisible({ timeout: 10_000 });
  });
});
