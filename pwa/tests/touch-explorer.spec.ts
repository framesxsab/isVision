// Touch Explorer behavioral coverage (core module — no dedicated spec before).
// Exercises the actual exploration loop: mousemove over an element →
// getElementAt → describeElement → spoken status bar update. The sticky
// status bar ("role=status" with a <p> child) is the only visible feedback
// surface on desktop; the sr-only announce region carries no <p>, so
// `div[role="status"] > p` pins the status bar unambiguously.
//
// The dedupe + throttle logic in useTouchExplorer means the assertion is
// "eventually the bar shows the element under the pointer" — expect() polling
// handles that; we additionally assert the bar *changes* to prove updates
// flow through, not just that it renders once.
//
// Pacing: the hook throttles explorations to one per 100ms (documented design
// to keep the speech engine sane). A hover chain can land two moves inside
// that window, and the second is legitimately dropped — so each hover waits
// out the throttle like a real user lingering on an element.

import { test, expect, type Page } from "@playwright/test";

// The sticky status bar — the visible spoken-description output.
const STATUS_BAR = 'div[role="status"][aria-live="polite"] > p';

// Longer than the hook's 100ms throttle, so the previous exploration is
// never still being throttled when the next hover fires.
const EXPLORATION_PACE_MS = 250;

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

test.describe("Touch Explorer", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/touch-explorer");
  });

  test("announces readiness to a live region", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Touch Explorer", exact: true })).toBeVisible();
    // useAnnounce defaults to assertive — the mount announcement lands in
    // AriaLive's sr-only alert region.
    await expect(page.locator('div[role="alert"].sr-only')).toContainText(
      "Touch Explorer is ready."
    );
  });

  test("speaks the element under the pointer, including disabled state", async ({ page }) => {
    await page.getByRole("button", { name: "Submit form" }).hover();
    await expect(page.locator(STATUS_BAR)).toContainText("Button: Submit form");

    await page.waitForTimeout(EXPLORATION_PACE_MS);
    await page.getByRole("button", { name: "Disabled button" }).hover();
    await expect(page.locator(STATUS_BAR)).toContainText("Button: Disabled button, disabled");
  });

  test("speaks headings, links, and images with role prefixes", async ({ page }) => {
    // Heading first — before the sticky bar exists, nothing overlaps it.
    await page.getByRole("heading", { name: "Welcome to Touch Explorer" }).hover();
    await expect(page.locator(STATUS_BAR)).toContainText(
      "Heading level 2: Welcome to Touch Explorer"
    );

    await page.waitForTimeout(EXPLORATION_PACE_MS);
    await page.getByRole("link", { name: "Learn about accessibility" }).hover();
    await expect(page.locator(STATUS_BAR)).toContainText(
      "Link: Learn about accessibility"
    );

    await page.waitForTimeout(EXPLORATION_PACE_MS);
    await page.getByRole("img", { name: /beautiful sunset/ }).hover();
    await expect(page.locator(STATUS_BAR)).toContainText(
      "Image: A beautiful sunset over the ocean with orange and purple sky"
    );
  });

  test("updates the description as the pointer moves between elements", async ({ page }) => {
    await page.getByRole("link", { name: "Learn about accessibility" }).hover();
    await expect(page.locator(STATUS_BAR)).toContainText(
      "Link: Learn about accessibility"
    );

    await page.waitForTimeout(EXPLORATION_PACE_MS);
    await page.getByRole("link", { name: "Join the community" }).hover();
    await expect(page.locator(STATUS_BAR)).toContainText("Link: Join the community");
  });

  test("Escape leaves Touch Explorer and returns home", async ({ page }) => {
    await page.getByRole("region", { name: /Touch exploration area/ }).focus();
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: /^isVisible$/i })).toBeVisible();
  });
});
