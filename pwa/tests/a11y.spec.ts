import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Routes to audit. NotFoundPage is exercised via the catch-all "*" route.
// Camera and mic permissions are denied in the browser context, so AI Vision
// and Voice Nav render their permission-denied paths — still valid a11y
// surfaces. Onboarding gates "/" until completed, so we set the localStorage
// flag before navigating, except on /onboarding itself.
const ROUTES = [
  { path: "/", label: "Home" },
  { path: "/onboarding", label: "Onboarding", skipOnboardingFlag: true },
  { path: "/settings", label: "Settings" },
  { path: "/touch-explorer", label: "Touch Explorer" },
  { path: "/ai-vision", label: "AI Vision" },
  { path: "/reader", label: "Reader" },
  { path: "/voice-nav", label: "Voice Navigation" },
  { path: "/tactile-output", label: "Tactile Output Lab" },
  { path: "/tactile-drill", label: "Tactile Drill" },
  { path: "/does-not-exist", label: "Not Found" },
] as const;

for (const route of ROUTES) {
  test(`a11y: ${route.label} (${route.path})`, async ({ page }) => {
    if (!route.skipOnboardingFlag) {
      await page.addInitScript(() => {
        // Match the shape that settingsStore (zustand persist) writes.
        localStorage.setItem(
          "isvisible-settings",
          JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
        );
      });
    }

    await page.goto(route.path);
    // Wait for the lazy-loaded route chunk to mount.
    await page.waitForLoadState("networkidle");

    const results = await new AxeBuilder({ page })
      // WCAG 2.1 AA is the contractual minimum for accessibility products.
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    // Only fail on critical or serious. Moderate/minor we surface as
    // warnings via the test output but don't block PRs.
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious"
    );

    if (blocking.length > 0) {
      const summary = blocking
        .map(
          (v) =>
            `[${v.impact}] ${v.id}: ${v.description}\n  ${v.helpUrl}\n  nodes: ${v.nodes
              .slice(0, 3)
              .map((n) => n.target.join(" "))
              .join(", ")}`
        )
        .join("\n\n");
      throw new Error(`Axe found ${blocking.length} blocking issue(s):\n\n${summary}`);
    }

    expect(blocking).toEqual([]);
  });
}
