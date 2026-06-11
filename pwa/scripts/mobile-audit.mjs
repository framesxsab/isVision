/**
 * Mobile layout audit — sweeps a few iPhone viewports across key routes
 * and flags layout regressions that the Playwright a11y suite doesn't
 * catch: <44px tap targets, horizontal overflow, and the bottom-nav
 * geometry per device.
 *
 * Prereq: dev server running on http://127.0.0.1:5173 (`npm run dev`).
 * Run:    `npm run audit:mobile`
 * Output: screenshots + JSON report under `.audit/` (gitignored).
 */
import { chromium, devices } from "playwright";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const OUT_DIR = ".audit";
mkdirSync(OUT_DIR, { recursive: true });
const BASE_URL = process.env.MOBILE_AUDIT_BASE_URL ?? "http://127.0.0.1:5173";

const TARGETS = [
  { name: "iphone-se", width: 375, height: 667, dpr: 2 },
  { name: "iphone-14", width: 390, height: 844, dpr: 3 },
  { name: "iphone-14-pm", width: 430, height: 932, dpr: 3 },
];

const ROUTES = [
  { name: "home", path: "/" },
  { name: "settings", path: "/settings" },
  { name: "onboarding-restart", path: "/onboarding?restart=1" },
];

const SETTINGS_BOOTSTRAP = JSON.stringify({
  state: {
    onboardingComplete: true,
    speechRate: 1.0,
    speechPitch: 1.0,
    speechVoice: null,
    fontScale: 1.0,
    highContrast: false,
    reduceMotion: false,
    hapticEnabled: true,
    voiceNavEnabled: true,
    offlineFirst: true,
    setupStatus: {
      camera: "denied",
      microphone: "unknown",
      voiceConfirmed: false,
      offlineTablesCached: false,
    },
  },
  version: 5,
});

const browser = await chromium.launch();
const report = [];

for (const t of TARGETS) {
  const context = await browser.newContext({
    ...devices["iPhone 13"],
    viewport: { width: t.width, height: t.height },
    deviceScaleFactor: t.dpr,
    isMobile: true,
    hasTouch: true,
  });

  const page = await context.newPage();
  await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate((bootstrap) => {
    localStorage.setItem("isvisible-settings", bootstrap);
  }, SETTINGS_BOOTSTRAP);

  for (const r of ROUTES) {
    await page.goto(BASE_URL + r.path, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(OUT_DIR, `mobile-${t.name}-${r.name}-top.png`), fullPage: false });

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT_DIR, `mobile-${t.name}-${r.name}-bottom.png`), fullPage: false });

    const metrics = await page.evaluate(() => {
      const touchTargets = Array.from(
        document.querySelectorAll("button, a, [role=button]")
      ).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName.toLowerCase(),
          label:
            el.getAttribute("aria-label") ||
            (el.textContent || "").trim().slice(0, 40),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        };
      });
      const small = touchTargets.filter(
        (m) => m.w > 0 && m.h > 0 && (m.w < 44 || m.h < 44)
      );
      const navEl = document.querySelector("nav[aria-label='Main navigation']");
      const tab = navEl?.getBoundingClientRect();
      const tabBox = tab ? { top: Math.round(tab.top), bottom: Math.round(tab.bottom), height: Math.round(tab.height) } : null;
      const docHeight = document.documentElement.scrollHeight;
      const overflowX = document.documentElement.scrollWidth > window.innerWidth;
      return { small, tabBox, docHeight, overflowX, viewportH: window.innerHeight };
    });

    report.push({ device: t.name, route: r.name, ...metrics });
  }
  await context.close();
}

await browser.close();
writeFileSync(join(OUT_DIR, "mobile-audit-report.json"), JSON.stringify(report, null, 2));
for (const r of report) {
  console.log(
    `[${r.device} ${r.route}] vp=${r.viewportH} doc=${r.docHeight} overflowX=${r.overflowX} tab=${r.tabBox ? `${r.tabBox.top}-${r.tabBox.bottom}` : "none"} small=${r.small.length}`
  );
  if (r.small.length) {
    for (const s of r.small) console.log(`  small: ${s.tag} ${s.w}x${s.h} "${s.label}"`);
  }
}
