// Verify the Privacy & data section in Settings actually renders every
// disclosure we claim to ship. The data lives in src/core/privacy/disclosures.ts;
// this test pins the visible surface so an accidental import/regression
// removing a row from the page is caught.

import { test, expect, type Page } from "@playwright/test";

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

const EXPECTED_DISCLOSURES = [
  "Clipboard",
  "Uploaded files and typed text",
  "Saved settings and drill progress",
  "Speech output",
  "Voice commands (microphone)",
  "AI Vision",
  "Reader",
  "Serial and HID braille displays",
];

test.describe("Settings privacy panel", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
  });

  test("renders every disclosure row", async ({ page }) => {
    const panel = page.getByRole("list", { name: "Privacy disclosures" });
    await expect(panel).toBeVisible();

    for (const title of EXPECTED_DISCLOSURES) {
      // Each disclosure title is the visible text inside a <summary>.
      await expect(panel.locator("li").filter({ hasText: title })).toHaveCount(1);
    }
  });

  test("each row has a scope chip with one of the known labels", async ({ page }) => {
    const panel = page.getByRole("list", { name: "Privacy disclosures" });
    // The chip text is one of these four — drift here would mean a scope
    // got added without a matching label entry.
    const validChips = [
      "Stays on this device",
      "Handed to your OS",
      "Goes to our server",
      "Goes to a third party",
    ];
    const rows = panel.locator("li");
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(EXPECTED_DISCLOSURES.length);
    for (let i = 0; i < count; i++) {
      const rowText = await rows.nth(i).innerText();
      expect(validChips.some((chip) => rowText.includes(chip))).toBe(true);
    }
  });

  test("expanding a row reveals the longer explanation", async ({ page }) => {
    const row = page
      .getByRole("list", { name: "Privacy disclosures" })
      .locator("li")
      .filter({ hasText: "AI Vision" });

    // The detail paragraph isn't in the accessible name until <details> is
    // open. Click the summary to expand.
    await row.locator("summary").click();
    await expect(row).toContainText(/NVIDIA|provider/i);
  });
});
