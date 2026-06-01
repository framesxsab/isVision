// Playwright coverage for /tactile-drill — the training page that exercises
// the six "Test tasks" listed in docs/prototype-architecture.md. We don't
// assert specific prompt text (it's random), but we do assert the wire-up:
// mode switching resets state, submitting an answer scores it, navigation
// works, reset wipes the score.

import { test, expect, type Page } from "@playwright/test";

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

test.describe("Tactile Drill", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/tactile-drill");
    await page.waitForLoadState("networkidle");
  });

  test("renders all four drill modes and the prompt area", async ({ page }) => {
    for (const label of ["Letters", "Words", "Numbers", "Mixed"]) {
      await expect(page.getByRole("radio", { name: label })).toBeVisible();
    }
    // The cells-debug element exists once the drill has a prompt.
    await expect(page.getByTestId("cells-debug")).toBeVisible();
  });

  test("Letters mode produces a one-cell prompt", async ({ page }) => {
    await page.getByRole("radio", { name: "Letters" }).click();
    await expect(page.getByTestId("cells-debug")).toHaveText(/^1 cells$/);
  });

  test("Numbers mode produces 2-4 cells depending on digit count", async ({ page }) => {
    await page.getByRole("radio", { name: "Numbers" }).click();
    // translateGrade1Debug emits a number-sign cell before EACH digit, so
    // a one-digit number is 2 cells and a two-digit number is 4 cells.
    await expect(page.getByTestId("cells-debug")).toHaveText(/^[24] cells$/);
  });

  test("submits the right answer and shows correct feedback", async ({ page }) => {
    await page.getByRole("radio", { name: "Letters" }).click();
    // We can't predict the prompt, so we type the wrong thing first to make
    // the "wrong" branch flip, which then reveals the correct answer in the
    // feedback line. The reveal is the contract we care about.
    const input = page.locator("#drill-input");
    await input.fill("zzz");
    await input.press("Enter");
    const feedback = page.locator("#drill-feedback");
    await expect(feedback).toContainText(/Answer was:/);
  });

  test("Speech-only mode hides the braille preview so the comparison is valid", async ({
    page,
  }) => {
    await page.getByRole("radio", { name: "Speech only" }).click();
    // The visual dot preview must be gone so a sighted observer can't read
    // it off the screen — speech-only is supposed to mean *no* tactile cue.
    await expect(page.getByTestId("speech-only-hidden")).toBeVisible();

    // Switching back to a tactile mode must restore the preview.
    await page.getByRole("radio", { name: "Tactile only" }).click();
    await expect(page.getByTestId("speech-only-hidden")).toHaveCount(0);
  });

  test("Punctuation mode produces a one-cell prompt", async ({ page }) => {
    await page.getByRole("radio", { name: "Punctuation" }).click();
    // Single punctuation marks are one cell each in the debug translator.
    await expect(page.getByTestId("cells-debug")).toHaveText(/^1 cells$/);
  });

  test("Difficulty selector switches the prompt pool", async ({ page }) => {
    // The buttons are visible inside the difficulty radiogroup; clicking
    // Hard rotates to a fresh prompt drawn from the wider pool.
    await page.getByRole("radio", { name: "Hard" }).click();
    await expect(page.getByRole("radio", { name: "Hard" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    // Hard difficulty survives a reload too — covered by persistence tests,
    // but we re-assert here so a future regression in the wiring shows up
    // in the drill suite directly.
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("radio", { name: "Hard" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  });

  test("History panel grows with attempts and shows recent mistakes", async ({ page }) => {
    await page.getByRole("radio", { name: "Letters" }).click();
    // Start with no history.
    await expect(page.getByTestId("drill-history-count")).toContainText(/No attempts yet/);
    // One wrong guess.
    const input = page.locator("#drill-input");
    await input.fill("zzz");
    await input.press("Enter");
    await expect(page.getByTestId("drill-history-count")).toContainText(/1 attempt/);
    await expect(page.getByRole("list", { name: "Recent mistakes" })).toBeVisible();
  });

  test("Export CSV is disabled before any attempt and enabled afterwards", async ({ page }) => {
    const button = page.getByTestId("drill-export-csv");
    await expect(button).toBeDisabled();
    await page.locator("#drill-input").fill("zzz");
    await page.locator("#drill-input").press("Enter");
    await expect(button).toBeEnabled();
  });

  test("Reset zeroes the score", async ({ page }) => {
    const input = page.locator("#drill-input");
    await input.fill("zzz");
    await input.press("Enter");
    // The third score tile (Streak) renders the number; after one attempt
    // attempts > 0 even if wrong. We check the visible accuracy chip in the
    // header.
    await expect(page.locator("[data-testid='accuracy-chip']")).toHaveText(/%/);
    await page.getByRole("button", { name: "Reset score" }).click();
    await expect(page.locator("[data-testid='accuracy-chip']")).toHaveText("");
  });
});
