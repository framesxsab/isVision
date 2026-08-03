// Device capability diagnostics coverage (P1 in development-improvement-spec).
// The Settings "Device capabilities" panel and the Troubleshoot page must
// tell users what works on this device AND give a concrete next step when
// something doesn't. We exercise both an available branch (stock Chromium)
// and an unavailable branch (API stripped off navigator before page load)
// for the browser-controlled APIs.
//
// Locators pin rows via aria-label prefixes (`li[aria-label^="..."]`) rather
// than visible text: several "Next:" suggestions mention other capabilities
// (e.g. "tap the microphone button" on the Speech recognition row), which
// would defeat text-based row matching.

import { test, expect, type Page } from "@playwright/test";

// Order must match CAPABILITY_ROWS in SettingsPage.tsx.
const SETTINGS_ROWS = [
  "Camera",
  "Microphone",
  "Speech recognition",
  "Speech output",
  "Vibration",
  "Clipboard paste",
  "Clipboard copy",
  "Web Serial",
  "WebHID",
  "Service worker",
  "Offline storage",
];

const SETTINGS_LIST = 'ul[aria-label="Device capability diagnostics"]';

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

// Same technique as tactile-capabilities.spec.ts: redefine the navigator key
// as undefined before the bundle evaluates so the detectors see the stripped
// API. Falls back to the prototype when the own property is locked down.
async function stripCapability(page: Page, key: "serial" | "hid" | "clipboard") {
  await page.addInitScript((stripKey) => {
    try {
      Object.defineProperty(navigator, stripKey, {
        value: undefined,
        configurable: true,
      });
    } catch {
      Object.defineProperty(Object.getPrototypeOf(navigator), stripKey, {
        get: () => undefined,
        configurable: true,
      });
    }
  }, key);
}

test.describe("Settings device capability diagnostics", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  test("renders every capability row with a status and a next action", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const list = page.locator(SETTINGS_LIST);
    await expect(list).toBeVisible();
    await expect(list.locator("li")).toHaveCount(SETTINGS_ROWS.length);

    // Pin both the order and the accessible-name contract: label, status,
    // help text, and a concrete next action announced as one sentence.
    for (let i = 0; i < SETTINGS_ROWS.length; i++) {
      await expect(list.locator("li").nth(i)).toHaveAttribute(
        "aria-label",
        new RegExp(`^${SETTINGS_ROWS[i]}: (Available|Needs fallback)\\..*Next action: .+`)
      );
    }
  });

  test("available branch: core Chromium APIs report Available", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // These three are guaranteed on localhost-served headless Chromium —
    // they anchor the "available" side of the branch coverage.
    await expect(page.locator(`${SETTINGS_LIST} li[aria-label^="Speech output:"]`))
      .toHaveAttribute("aria-label", /Speech output: Available\./);
    await expect(page.locator(`${SETTINGS_LIST} li[aria-label^="Clipboard copy:"]`))
      .toHaveAttribute("aria-label", /Clipboard copy: Available\./);
    await expect(page.locator(`${SETTINGS_LIST} li[aria-label^="Service worker:"]`))
      .toHaveAttribute("aria-label", /Service worker: Available\./);
  });

  test("unavailable branch: stripped Web Serial reports fallback guidance", async ({ page }) => {
    await stripCapability(page, "serial");
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    const row = page.locator(`${SETTINGS_LIST} li[aria-label^="Web Serial:"]`);
    await expect(row).toHaveAttribute("aria-label", /Web Serial: Needs fallback\./);
    // The spoken name must include the practical suggestion, not just a
    // bare "unsupported".
    await expect(row).toHaveAttribute("aria-label", /Chromium/);
    await expect(row).toContainText("Web Serial is not available in this browser.");
  });

  test("unavailable branch: stripped WebHID and clipboard report fallback guidance", async ({ page }) => {
    await stripCapability(page, "hid");
    await stripCapability(page, "clipboard");
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    await expect(page.locator(`${SETTINGS_LIST} li[aria-label^="WebHID:"]`))
      .toHaveAttribute("aria-label", /WebHID: Needs fallback\./);
    await expect(page.locator(`${SETTINGS_LIST} li[aria-label^="Clipboard paste:"]`))
      .toHaveAttribute("aria-label", /Clipboard paste: Needs fallback\./);
    // Clipboard stripping takes both directions out.
    await expect(page.locator(`${SETTINGS_LIST} li[aria-label^="Clipboard copy:"]`))
      .toHaveAttribute("aria-label", /Clipboard copy: Needs fallback\./);
  });
});

test.describe("Troubleshoot page", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
  });

  function capabilityRows(page: Page) {
    return page.getByRole("region", { name: "Capability details" }).getByRole("listitem");
  }

  test("summarizes blocked items and offers an actionable setup CTA", async ({ page }) => {
    await page.goto("/troubleshoot");
    await page.waitForLoadState("networkidle");

    // Camera + microphone permissions start "unknown", so at least those two
    // rows must surface as needing attention.
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary).toContainText(/need attention/);

    const rows = capabilityRows(page);
    // Two permission rows plus the eleven capability rows.
    await expect(rows).toHaveCount(2 + SETTINGS_ROWS.length);

    const cameraRow = page.locator('li[aria-label^="Camera access:"]');
    await expect(cameraRow).toHaveAttribute(
      "aria-label",
      /Camera access: Unavailable\..*Re-run setup/
    );
    // The row-level CTA is a real focusable control (not aria-hidden) and
    // routes into the setup restart flow.
    const cta = cameraRow.getByRole("button", { name: "Re-run setup for Camera access" });
    await expect(cta).toBeVisible();
    await cta.click();
    await expect(page).toHaveURL(/\/onboarding\?restart=1$/);
  });

  test("granted permission flips the row to Ready and removes the CTA", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "isvisible-settings",
        JSON.stringify({
          state: {
            onboardingComplete: true,
            setupStatus: {
              camera: "granted",
              microphone: "granted",
              voiceConfirmed: true,
              offlineTablesCached: true,
            },
          },
          version: 5,
        })
      );
    });
    // The page re-queries navigator.permissions on mount; grant camera and
    // microphone so the live refresh can't flip the seeded state back.
    await page.context().grantPermissions(["camera", "microphone"]);

    await page.goto("/troubleshoot");
    await page.waitForLoadState("networkidle");

    const cameraRow = page.locator('li[aria-label^="Camera access:"]');
    await expect(cameraRow).toHaveAttribute("aria-label", /Camera access: Ready\./);
    await expect(
      cameraRow.getByRole("button", { name: "Re-run setup for Camera access" })
    ).toHaveCount(0);
  });
});
