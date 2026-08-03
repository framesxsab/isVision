// Camera lifecycle audit for AI Vision (P3 acceptance criterion: camera
// tracks stop when leaving the page). Chromium's fake media device plus an
// auto-granted camera permission give us a real MediaStream without real
// hardware, so we can count track.stop() calls across the exit path.
//
// launchOptions forces a dedicated worker, so it must live at the top level
// of its own file rather than inside a describe group.

import { test, expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __stoppedTracks: number;
  }
}

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

test.use({
  permissions: ["camera"],
  launchOptions: {
    args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
  },
});

test("camera tracks stop when leaving AI Vision", async ({ page }) => {
  await skipOnboarding(page);
  await page.addInitScript(() => {
    window.__stoppedTracks = 0;
    const original = MediaStreamTrack.prototype.stop;
    MediaStreamTrack.prototype.stop = function () {
      window.__stoppedTracks += 1;
      return original.call(this);
    };
  });

  await page.goto("/ai-vision");
  // Wait until the camera actually started before judging the exit path.
  await page.waitForFunction(() => document.querySelector("video")?.srcObject != null);

  await page.getByRole("button", { name: "Go back to home" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect
    .poll(() => page.evaluate(() => window.__stoppedTracks))
    .toBeGreaterThan(0);
});
