import { test, expect } from "@playwright/test";

// The Hardware Emulator is contributor tooling for verifying exported compact
// frames without owning a refreshable braille display. The tests below cover
// the two contracts the emulator promises: malformed input gives line-level
// errors, and well-formed input plays back through a keyboard-accessible
// stepper.

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    // Skip onboarding so the route resolves directly.
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
});

test("reports parse errors with the exact offending line numbers", async ({ page }) => {
  await page.goto("/hardware-emulator");
  await page.waitForLoadState("networkidle");

  const input = page.getByTestId("emulator-input");
  await input.fill(
    [
      "# header",
      "CFG hold_ms=900 blank=1",
      "F 0 0 300",
      "WAT 1 2 3",
      "F 1 0 1",
      "END",
    ].join("\n")
  );

  const errors = page.getByTestId("emulator-errors");
  await expect(errors).toBeVisible();
  await expect(errors).toContainText("Line 3");
  await expect(errors).toContainText("Line 4");
  await expect(errors).toContainText(/Mask must be an integer/);
  await expect(errors).toContainText(/Unknown directive/);
});

test("step-forward advances the displayed frame and is keyboard reachable", async ({ page }) => {
  await page.goto("/hardware-emulator");
  await page.waitForLoadState("networkidle");

  const input = page.getByTestId("emulator-input");
  await input.fill(
    [
      "CFG hold_ms=900 blank=0",
      "F 0 0 1",
      "F 1 1 3",
      "F 2 2 9",
      "END",
    ].join("\n")
  );

  const display = page.getByTestId("emulator-display");
  await expect(display).toContainText("Frame 1 of 3");

  // The step-forward control must be focusable and operable from the keyboard
  // — emulator users include contributors testing screen-reader paths.
  const stepButton = page.getByTestId("emulator-step");
  await stepButton.focus();
  await expect(stepButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(display).toContainText("Frame 2 of 3");

  await page.keyboard.press("Enter");
  await expect(display).toContainText("Frame 3 of 3");
});
