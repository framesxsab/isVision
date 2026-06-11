import { test, expect } from "@playwright/test";

test.describe("Onboarding setup readiness", () => {
  test("restart flow reaches the readiness checklist and persists setup status", async ({
    page,
  }) => {
    await page.goto("/onboarding?restart=1");
    await page.waitForLoadState("networkidle");

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Touch Explorer" })).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Permissions" })).toBeVisible();

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Voice" })).toBeVisible();

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Readiness" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Setup readiness checklist" })).toContainText(
      "Offline braille tables"
    );

    await page.getByRole("button", { name: "Get started" }).click();
    await page.waitForURL("**/");

    const setupStatus = await page.evaluate(() => {
      const raw = localStorage.getItem("isvisible-settings");
      return raw ? JSON.parse(raw)?.state?.setupStatus : null;
    });
    expect(setupStatus?.voiceConfirmed).toBe(true);
    expect(typeof setupStatus?.offlineTablesCached).toBe("boolean");
  });
});
