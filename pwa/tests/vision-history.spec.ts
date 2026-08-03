// AI Vision history + handoff coverage (P3 in development-improvement-spec,
// Tier 1 item 2 in ux-impact-plan). The capture path is exercised through
// image upload so the suite runs on machines without a real camera; camera
// lifecycle (tracks stop on exit) lives in vision-camera.spec.ts.

import { test, expect, type Page } from "@playwright/test";

const DESCRIPTION = "A red medicine bottle with a white child-proof cap.";

// Minimal 1x1 JPEG — enough for the upload path, which does not run the
// sharpness gate (that only applies to live camera frames).
const TINY_JPEG_BASE64 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==";

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

async function mockVisionApi(page: Page) {
  await page.route("**/api/vision/describe", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ description: DESCRIPTION }),
    });
  });
}

async function uploadImage(page: Page) {
  await page.locator('input[type="file"]').setInputFiles({
    name: "label.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(TINY_JPEG_BASE64, "base64"),
  });
}

test.describe("AI Vision history and handoffs", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await mockVisionApi(page);
    await page.goto("/ai-vision");
  });

  test("upload produces a description with the handoff row", async ({ page }) => {
    await uploadImage(page);

    await expect(page.getByText(DESCRIPTION)).toBeVisible();
    const actions = page.getByRole("group", { name: "Description actions" });
    await expect(actions).toBeVisible();
    await expect(actions.getByRole("button", { name: "Copy" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "Send to Reader" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "Send to Tactile" })).toBeVisible();
    await expect(actions.getByRole("button", { name: "Clear vision history" })).toBeVisible();
  });

  test("clear removes the description and confirms via live region", async ({ page }) => {
    await uploadImage(page);
    await expect(page.getByText(DESCRIPTION)).toBeVisible();

    await page.getByRole("button", { name: "Clear vision history" }).click();

    // Assertive live region carries the spoken confirmation.
    await expect(page.getByRole("alert")).toHaveText(/Vision history cleared/);
    await expect(page.getByText(DESCRIPTION)).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Description actions" })).toHaveCount(0);
  });

  test("second description lands in the history list", async ({ page }) => {
    await uploadImage(page);
    await expect(page.getByText(DESCRIPTION)).toBeVisible();
    await uploadImage(page);

    const history = page.getByText(/^Previous descriptions \(2\)$/);
    await expect(history).toBeVisible();

    // Clearing also wipes the history list, not just the current panel.
    await page.getByRole("button", { name: "Clear vision history" }).click();
    await expect(history).toHaveCount(0);
  });

  test("send to Reader preloads the description", async ({ page }) => {
    await uploadImage(page);
    await expect(page.getByText(DESCRIPTION)).toBeVisible();

    await page.getByRole("button", { name: "Send to Reader" }).click();

    await expect(page).toHaveURL(/\/reader$/);
    await expect(page.locator("article").getByText(DESCRIPTION)).toBeVisible();
  });

  test("send to Tactile loads the description into the Tactile Lab", async ({ page }) => {
    await uploadImage(page);
    await expect(page.getByText(DESCRIPTION)).toBeVisible();

    await page.getByRole("button", { name: "Send to Tactile" }).click();

    await expect(page).toHaveURL(/\/tactile-output$/);
    await expect(page.locator("#tactile-source")).toHaveValue(new RegExp(DESCRIPTION));
  });
});
