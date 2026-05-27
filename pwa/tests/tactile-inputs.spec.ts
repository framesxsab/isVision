// Playwright coverage for the new Tactile Lab input adapters: clipboard paste,
// file upload, and the Reader → Tactile Lab session-storage handoff. None of
// these go anywhere near the serial port — they're pure UI plumbing.

import { test, expect, type Page } from "@playwright/test";

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

test.describe("Tactile Lab input adapters", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("clipboard paste populates the source textarea", async ({ page, context, browserName }) => {
    // Grant clipboard read in browsers that gate it behind permissions. WebKit
    // doesn't recognize "clipboard-read" so we just skip the grant — the
    // test still works because we stub the underlying API below.
    if (browserName !== "webkit") {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    }

    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          readText: async () => "pasted from chat",
          writeText: async () => undefined,
        },
      });
    });

    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Paste text from clipboard" }).click();
    await expect(page.locator("#tactile-source")).toHaveValue("pasted from chat");
    await expect(page.locator("header span[aria-hidden='true']")).toHaveText(/Pasted 16/);
  });

  test("file upload reads a .txt file into the textarea", async ({ page }) => {
    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");

    // The visible Upload button delegates to a hidden file input. Playwright
    // can drive it directly via setInputFiles, which is more reliable than
    // simulating the chooser dialog.
    await page.locator("input[type='file']").setInputFiles({
      name: "hello.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("hello from disk"),
    });

    await expect(page.locator("#tactile-source")).toHaveValue("hello from disk");
    await expect(page.locator("header span[aria-hidden='true']")).toHaveText(
      /Loaded hello\.txt/
    );
  });

  test("non-text file uploads show an error without changing the textarea", async ({ page }) => {
    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");

    const sourceValueBefore = await page.locator("#tactile-source").inputValue();

    await page.locator("input[type='file']").setInputFiles({
      name: "image.png",
      mimeType: "image/png",
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
    });

    await expect(page.locator("header span[aria-hidden='true']")).toHaveText(
      /Unsupported file type/
    );
    expect(await page.locator("#tactile-source").inputValue()).toBe(sourceValueBefore);
  });

  test("Reader handoff via sessionStorage seeds the Tactile Lab textarea", async ({ page }) => {
    // Seed the handoff before the first navigation. We use a real navigation
    // listener (not addInitScript) because addInitScript re-runs on every
    // navigation, which would re-seed the slot we're trying to verify is
    // one-shot.
    await page.goto("/tactile-output");
    await page.evaluate(() => {
      sessionStorage.setItem(
        "isvisible:tactile-handoff",
        JSON.stringify({ text: "article body text", source: "Reader", at: Date.now() })
      );
    });
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(page.locator("#tactile-source")).toHaveValue("article body text");

    // The handoff key must be gone after the consumer mounts — the page
    // takes the payload exactly once.
    const remaining = await page.evaluate(() =>
      sessionStorage.getItem("isvisible:tactile-handoff")
    );
    expect(remaining).toBeNull();
  });
});
