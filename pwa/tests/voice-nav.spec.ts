// Voice Navigation behavioral coverage (core module — only unit + axe coverage
// existed before). Headless Chromium actually ships a native SpeechRecognition,
// so we inject a fake one to drive the full pipeline end to end:
//
//  * WITH a mocked window.SpeechRecognition, listenWithAlternatives →
//    resolveVoiceCommand → echo confirm → action run. We assert the visible
//    transcript, the confirm announcement, and that a real navigation happens.
//  * WITHOUT SpeechRecognition, the graceful fallback surfaces a clear error
//    banner with a dismiss action.
//
// The mock dispatches a single final result then onend — exactly the contract
// the engine uses to resolve (see SpeechRecognition.ts).

import { test, expect, type Page } from "@playwright/test";

/** Inject a fake Web Speech API that "hears" one utterance per start(). */
function mockSpeechRecognition(page: Page, transcriptForSession: string[]) {
  return page.addInitScript((utterances) => {
    // Counter lives here (inside the browser script scope) — closure state
    // from the Node context does not survive addInitScript serialization.
    let utteranceIndex = 0;
    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      maxAlternatives = 1;
      lang = "";
      onresult: (event: unknown) => void = () => {};
      onerror: (event: unknown) => void = () => {};
      onend: () => void = () => {};

      start() {
        const turn = utterances[Math.min(utteranceIndex, utterances.length - 1)];
        utteranceIndex += 1;
        window.setTimeout(() => {
          this.onresult({
            resultIndex: 0,
            results: [{ isFinal: true, length: 1, 0: { transcript: turn } }],
          });
          window.setTimeout(() => this.onend(), 10);
        }, 10);
      }

      stop() {
        this.onend();
      }

      abort() {
        this.onend();
      }
    }
    window.SpeechRecognition = MockSpeechRecognition as never;
    window.webkitSpeechRecognition = MockSpeechRecognition as never;
  }, transcriptForSession);
}

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

async function removeSpeechRecognition(page: Page) {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).SpeechRecognition;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).webkitSpeechRecognition;
  });
}

const MIC_BUTTON_NAME =
  "Press to speak a command or question. You can also press F6 anywhere in the app.";

test.describe("Voice Navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Init scripts below must run before goto; they apply to the loaded page.
    await skipOnboarding(page);
  });

  test("speaks a navigation command and confirms it aloud", async ({ page }) => {
    await mockSpeechRecognition(page, ["open the reader"]);
    await page.goto("/voice-nav");

    await page.getByRole("button", { name: MIC_BUTTON_NAME }).click();

    await expect(page.getByText('You said: "open the reader"')).toBeVisible();

    await expect(page.locator('div[role="alert"].sr-only')).toContainText(
      'I heard "open the reader". Open Accessible Reader.'
    );

    await expect(page).toHaveURL(/\/reader$/, { timeout: 5_000 });
    await expect(page.getByRole("heading", { name: "Reader", exact: true })).toBeVisible();
  });

  test("records unrecognized utterances with no command in history", async ({ page }) => {
    await page.route("**/api/voice/intent", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ command: null, confidence: 0 }),
      })
    );
    await mockSpeechRecognition(page, ["banana sandwich"]);
    await page.goto("/voice-nav");

    await page.getByRole("button", { name: MIC_BUTTON_NAME }).click();

    await expect(page.getByText('You said: "banana sandwich"')).toBeVisible();

    await page.locator("details summary").click();
    const entry = page.locator("details ul li").filter({ hasText: "banana sandwich" });
    await expect(entry).toBeVisible();
    await expect(entry).toContainText("—");
  });

  test("falls back gracefully when speech recognition is unsupported", async ({ page }) => {
    await removeSpeechRecognition(page);
    await page.goto("/voice-nav");

    await page.getByRole("button", { name: MIC_BUTTON_NAME }).click();

    const banner = page.getByRole("alert").filter({ hasText: "not supported" });
    await expect(banner).toBeVisible();
    await expect(banner).toContainText("Voice recognition is not supported in this browser.");

    await page.getByRole("button", { name: "Dismiss" }).click();
    await expect(banner).toHaveCount(0);
  });
});
