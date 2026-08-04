// Tactile Graphics (Phase 4 "spatial tactile output") behavioral coverage.
// Uploads an SVG with a bold black region and asserts the full conversion
// pipeline visible in the UI: pin preview, region segmentation, and the
// compact protocol the frame output produces for hardware.

import { test, expect, type Page } from "@playwright/test";

const HALF_BLACK_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16">
     <rect width="8" height="16" fill="#000000"/>
     <rect x="8" width="8" height="16" fill="#ffffff"/>
   </svg>`
);

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

async function uploadAndConvert(page: Page) {
  await page.goto("/tactile-graphics");
  await page.setInputFiles('input[aria-label="Upload an image"]', {
    name: "shape.svg",
    mimeType: "image/svg+xml",
    buffer: HALF_BLACK_SVG,
  });
  await expect(page.getByText(/Loaded shape\.svg/)).toBeVisible();
  await page.getByRole("button", { name: "Convert to pin matrix" }).click();
}

test.describe("Tactile Graphics", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("converts an image into a pin matrix with labeled regions", async ({ page }) => {
    await uploadAndConvert(page);

    // Default grid: 8 cells x 4 cell-rows → a 16x16 pin matrix.
    const preview = page.getByRole("img", { name: /16 columns and 16 rows/ });
    await expect(preview).toBeVisible();
    await expect(preview.locator("pre")).toContainText("#");

    // The left half is black, so raised pins cluster on the left.
    const regions = page.locator('ul[aria-label="Detected regions"] li');
    await expect(regions).not.toHaveCount(0);
    await expect(regions.first()).toContainText("Region A");

    // The spoken summary lands in the always-visible status region.
    await expect(
      page.locator('[role="status"]').filter({ hasText: /1 region: Region A/ })
    ).toBeVisible();
  });

  test("produces compact-protocol output playable on hardware", async ({ page }) => {
    // Clipboard write is needed for the copy-status assertion.
    await page.context().grantPermissions(["clipboard-write", "clipboard-read"]);
    await uploadAndConvert(page);

    const output = page.locator('textarea[aria-label="Compact protocol output"]');
    await expect(output).toHaveValue(/# isVisible tactile compact protocol v1/);
    await expect(output).toHaveValue(/CFG hold_ms=900 blank=1/);
    // 4 cell-rows → one F line per row, 8 masks each.
    await expect(output).toHaveValue(/F 0 0 \d+( \d+){7}/);
    await expect(output).toHaveValue(/END/);

    // The braille preview mirrors the same cells as Unicode braille.
    const braille = page.locator('[aria-label="Braille cell preview"]');
    await expect(braille).toContainText(/[⠁-⣿]/);

    await page.getByRole("button", { name: "Copy protocol" }).click();
    await expect(page.getByText(/Copied 4 frames of compact protocol/)).toBeVisible();
  });

  test("grid size controls reshape the pin matrix", async ({ page }) => {
    await uploadAndConvert(page);

    await page.getByRole("button", { name: "12", exact: true }).click();
    // 12 cells per row → 24 pins wide.
    await expect(page.getByRole("img", { name: /24 columns and 16 rows/ })).toBeVisible();
  });
});
