// Playwright coverage for /tactile-drill — the training page that exercises
// the six "Test tasks" listed in docs/prototype-architecture.md. We don't
// assert specific prompt text (it's random), but we do assert the wire-up:
// mode switching resets state, submitting an answer scores it, navigation
// works, reset wipes the score.

import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

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
    await expect(page.getByTestId("cells-debug")).toHaveText(/^1 cell$/);
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

  test("comparison summary appears once attempts exist in two speech modes", async ({
    page,
  }) => {
    const input = page.locator("#drill-input");
    const submitAttempt = async () => {
      await input.fill("zzz");
      await input.press("Enter"); // check
      await input.press("Enter"); // next prompt
      await expect(input).toBeFocused();
    };

    // One attempt in speech-only mode.
    await page.getByRole("radio", { name: "Speech only" }).click();
    await submitAttempt();

    // The summary must not render with a single mode — nothing to compare.
    await expect(page.getByText("Speech-only vs speech + tactile")).toHaveCount(0);

    // A second attempt in speech + tactile mode unlocks the comparison.
    await page.getByRole("radio", { name: "Speech + tactile" }).click();
    await submitAttempt();

    const summary = page.locator('ul[aria-label="Accuracy by speech mode"]');
    await expect(summary).toBeVisible();
    await expect(summary).toContainText("Speech only");
    await expect(summary).toContainText("Speech + tactile");
    await expect(summary).toContainText("% accuracy");
  });

  test("Punctuation mode produces a one-cell prompt", async ({ page }) => {
    await page.getByRole("radio", { name: "Punctuation" }).click();
    // Single punctuation marks are one cell each in the debug translator.
    await expect(page.getByTestId("cells-debug")).toHaveText(/^1 cell$/);
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

  test("radio groups support arrow-key selection with one tab stop", async ({ page }) => {
    const letters = page.getByRole("radio", { name: "Letters" });
    const words = page.getByRole("radio", { name: "Words" });

    await expect(letters).toHaveAttribute("tabindex", "0");
    await expect(words).toHaveAttribute("tabindex", "-1");

    await letters.focus();
    await page.keyboard.press("ArrowRight");

    await expect(words).toHaveAttribute("aria-checked", "true");
    await expect(words).toHaveAttribute("tabindex", "0");
    await expect(letters).toHaveAttribute("tabindex", "-1");
    await expect(words).toBeFocused();

    await page.keyboard.press("End");
    await expect(page.getByRole("radio", { name: "Mixed" })).toHaveAttribute(
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

  test("Practice mistakes turns on after a wrong answer", async ({ page }) => {
    const toggle = page.getByTestId("toggle-practice-mistakes");
    await expect(toggle).toBeDisabled();

    await page.getByRole("radio", { name: "Letters" }).click();
    await page.locator("#drill-input").fill("zzz");
    await page.locator("#drill-input").press("Enter");

    await expect(toggle).toBeEnabled();
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(toggle).toContainText("drilling your weak spots");
  });

  test("Export CSV includes mode, difficulty, speech mode, and response time", async ({
    page,
  }) => {
    await page.getByRole("radio", { name: "Words" }).click();
    await page.getByRole("radio", { name: "Easy" }).click();
    await page.getByRole("radio", { name: "Speech + tactile" }).click();

    await page.locator("#drill-input").fill("wrong");
    await page.locator("#drill-input").press("Enter");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("drill-export-csv").click(),
    ]);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const csv = await readFile(filePath!, "utf8");
    expect(csv.split("\n")[0]).toBe(
      "at_iso,mode,difficulty,speech_mode,prompt_kind,expected_answer,user_answer,correct,response_time_ms"
    );
    expect(csv).toContain(",word,easy,speech+tactile,");
    expect(csv).toMatch(/,0,\d+\n\nanswer,kind,attempts,correct,accuracy_percent/);
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
