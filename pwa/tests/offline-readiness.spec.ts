// End-to-end verification of the PWA's offline promise. Each test loads the
// app online first so the service worker can install, then flips
// context.setOffline(true) and exercises the parts that should keep working.
//
// Caveats baked into the assertions:
//   - The vite-plugin-pwa SW is "registerType: prompt"; we still wait for
//     navigator.serviceWorker.ready so the controller has activated before
//     we cut the network.
//   - Liblouis assets (~1.6 MB WASM build + tables) live in a runtime
//     CacheFirst cache; they're only present after the user opts into
//     Grade 2 once online.

import { test, expect, type Page } from "@playwright/test";

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

async function waitForServiceWorker(page: Page) {
  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return;
    await navigator.serviceWorker.ready;
  });
}

test.describe("Offline behaviour", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("app shell + Grade 1 keep working after going offline", async ({ page, context }) => {
    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");
    await waitForServiceWorker(page);

    // Cut the network and confirm a reload still lands on the page.
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator("h1")).toHaveText("Tactile Lab");

    // Grade 1 is bundled in the initial JS — must keep working with no
    // network at all.
    await page.locator("#tactile-source").fill("ab");
    await expect(page.locator("textarea[aria-label='Generated tactile frame output']"))
      .toContainText("F 0 0");

    // The route to the drill page is a separate chunk — confirm it loads
    // from the precache too.
    await page.goto("/tactile-drill");
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("h1")).toHaveText("Tactile Drill");
  });

  test("Settings shows the offline-readiness panel with at least one cached row", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await waitForServiceWorker(page);

    // Trigger a fresh check so the panel reflects the post-install cache.
    await page.getByRole("button", { name: "Check offline readiness" }).click();

    // The app-shell row should reach "Cached" once the SW has populated
    // the precache. We don't assert on Liblouis here because the user
    // hasn't opened Grade 2 yet.
    const shellRow = page
      .getByRole("list", { name: "Offline-readiness checklist" })
      .locator("li")
      .filter({ hasText: "App shell" });
    await expect(shellRow).toContainText("Cached");
  });

  test("Grade 2 surfaces the Retry button when offline and uncached", async ({
    page,
    context,
  }) => {
    await page.goto("/tactile-output");
    await page.waitForLoadState("networkidle");
    await waitForServiceWorker(page);

    // Never load Grade 2 online → Liblouis assets are not in the runtime
    // cache. Going offline and flipping to Grade 2 must produce the Retry
    // button rather than a silent failure.
    await context.setOffline(true);
    await page.getByRole("button", { name: "Grade 2 (Liblouis)" }).click();

    const retry = page.getByRole("button", { name: "Retry the Liblouis translation" });
    await expect(retry).toBeVisible({ timeout: 20_000 });
  });
});
