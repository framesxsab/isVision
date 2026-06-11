import { test, expect, type Page } from "@playwright/test";

async function skipOnboarding(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "isvisible-settings",
      JSON.stringify({ state: { onboardingComplete: true }, version: 0 })
    );
  });
}

test.describe("Reader to Tactile Lab handoff", () => {
  test.beforeEach(async ({ page }) => {
    await skipOnboarding(page);
    await page.route("**/api/reader/fetch", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          html: `
            <html>
              <head><title>Study Article</title></head>
              <body>
                <h1>Study Article</h1>
                <p>First paragraph for reading practice.</p>
                <p>Second paragraph selected text for tactile study.</p>
              </body>
            </html>
          `,
        }),
      });
    });
  });

  test("sends selected article text into the Tactile Lab", async ({ page }) => {
    await page.goto("/reader");
    await page.locator("#url-input").fill("https://example.com/study");
    await page.getByRole("button", { name: "Load" }).click();

    await expect(page.getByRole("heading", { name: "Study Article" }).first())
      .toBeVisible();
    await expect(page.getByText("Second paragraph selected text for tactile study."))
      .toBeVisible();

    await page.locator("article p").nth(1).click({ clickCount: 3 });

    const sendSelection = page.getByTestId("send-selection-to-tactile");
    await expect(sendSelection).toBeVisible();
    await sendSelection.click();

    await expect(page).toHaveURL(/\/tactile-output$/);
    await expect(page.locator("#tactile-source")).toHaveValue(
      /Second paragraph selected text for tactile study/
    );
  });
});
