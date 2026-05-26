import { test, expect } from "@playwright/test";

// Browsers don't expose navigator.serial in Playwright by default, and even
// where they do `requestPort()` needs a real user gesture and a connected
// device. We swap in a hand-rolled implementation before the page boots so
// the Send button drives a WritableStream we can read back, end-to-end:
// source text → Grade 1 translator → frame builder → compact serializer →
// TextEncoder → writer.write(). What lands in the fake port is exactly what
// firmware would receive over the wire.

declare global {
  interface Window {
    __capturedSerialChunks?: Uint8Array[];
    __serialOpenCalls?: number;
    __serialCloseCalls?: number;
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__capturedSerialChunks = [];
    window.__serialOpenCalls = 0;
    window.__serialCloseCalls = 0;

    const fakePort = {
      open: async (_options: { baudRate: number }) => {
        window.__serialOpenCalls = (window.__serialOpenCalls ?? 0) + 1;
      },
      close: async () => {
        window.__serialCloseCalls = (window.__serialCloseCalls ?? 0) + 1;
      },
      writable: new WritableStream<Uint8Array>({
        write(chunk) {
          // Copy so the source ArrayBuffer can be reused safely.
          window.__capturedSerialChunks!.push(new Uint8Array(chunk));
        },
      }),
    };

    // Chromium ships a real navigator.serial that rejects without a user
    // gesture; defineProperty overrides it cleanly.
    Object.defineProperty(navigator, "serial", {
      value: { requestPort: async () => fakePort },
      configurable: true,
    });

    // Skip the onboarding gate so '/' navigation isn't needed.
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
});

test("Send streams the compact frame protocol over (stubbed) Web Serial", async ({ page }) => {
  await page.goto("/tactile-output");
  await page.waitForLoadState("networkidle");

  // Use a tiny, deterministic input so the expected protocol is short and
  // the test failure message is human-readable.
  const sourceTextarea = page.locator("#tactile-source");
  await sourceTextarea.fill("abc");

  // Group size defaults to 1; assert it so a future default change can't
  // silently shift the expected frames.
  await expect(page.getByRole("button", { name: "1 cell" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("button", { name: /Send \(N\)/ }).click();

  // The visible status chip is the soonest signal that the write succeeded.
  await expect(page.locator("header span[aria-hidden='true']")).toHaveText(/Sent \d+ compact frames/);

  const captured = await page.evaluate(() => {
    const chunks = window.__capturedSerialChunks ?? [];
    const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    return new TextDecoder().decode(merged);
  });

  const expected = [
    "# isVisible tactile compact protocol v1",
    "CFG hold_ms=900 blank=1",
    "F 0 0 1",
    "B",
    "F 1 1 3",
    "B",
    "F 2 2 9",
    "B",
    "END",
    "",
  ].join("\n");

  expect(captured).toBe(expected);

  // Sanity-check that we opened the port at 115200 (well, just that open()
  // ran) and tore it down. A leaked port would be a real-world bug.
  const openCalls = await page.evaluate(() => window.__serialOpenCalls);
  const closeCalls = await page.evaluate(() => window.__serialCloseCalls);
  expect(openCalls).toBe(1);
  expect(closeCalls).toBe(1);
});

test("N keyboard shortcut triggers Send", async ({ page }) => {
  await page.goto("/tactile-output");
  await page.waitForLoadState("networkidle");

  await page.locator("#tactile-source").fill("a");

  // Click body to blur the textarea so the keystroke doesn't get typed into
  // it; the document-level keydown handler exits early when focus is in a
  // text field.
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("n");

  await expect(page.locator("header span[aria-hidden='true']")).toHaveText(/Sent \d+ compact frames/);

  const captured = await page.evaluate(() => {
    const chunks = window.__capturedSerialChunks ?? [];
    const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      merged.set(c, offset);
      offset += c.byteLength;
    }
    return new TextDecoder().decode(merged);
  });

  expect(captured).toContain("F 0 0 1");
  expect(captured.trimEnd().endsWith("END")).toBe(true);
});
