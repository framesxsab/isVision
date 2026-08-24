# Accessibility Statement — isVisible

**Conformance target:** WCAG 2.2 AA. isVisible is built to be operable with keyboard-only, screen readers, and reduced-motion preferences. This file is the canonical claim — see `docs/research/oss-release-research.md` §3 for the audited gap list.

## Foundations (what exists in code)

| Pattern | File | Status |
|---|---|---|
| Live regions (polite `role=status` + assertive `role=alert`, 50 ms dedup) | `pwa/src/core/a11y/AriaLive.tsx:18-62` | Shipped |
| Skip link to `#main-content` | `pwa/src/core/a11y/SkipLinks.tsx` + `App.tsx:65,68` | Shipped |
| Focus trap for dialogs (`role=dialog aria-modal`) | `pwa/src/core/a11y/FocusTrap.tsx:6-50` + `Modal.tsx:35` | Shipped |
| Route announce + focus to `h1` (poll 500 ms, `tabindex=-1`) | `pwa/src/core/hooks/useRouteAnnounce.ts:46-52` | Shipped |
| Button primitives (`min-h-touch` 44 px, `focus-visible:ring-2`) | `pwa/src/components/Button.tsx:57-60` | Shipped |
| TabBar `aria-current=page`, safe-area inset | `pwa/src/components/TabBar.tsx:21-54` | Shipped |
| Reader keyboard (`Space` toggle, `←→` paragraph, `↑↓` speed + `announce`) | `pwa/src/modules/reader/ReaderPage.tsx:139-177` | Shipped |
| Touch Explorer keyboard fallback (arrows virtual cursor, `role=region`) | `pwa/src/modules/touch-explorer/TouchExplorerPage.tsx` | Shipped `v0.1.0` |
| Reduced-motion kill-switch (unlayered cascade override) | `pwa/src/index.css:119-128` | Shipped `v0.1.0` |
| High-contrast mode (`high-contrast` class) | `pwa/src/index.css:102-114` + `SettingsPage.tsx` | Shipped |

`pwa/index.html:2` sets `lang="en"` and `user-scalable=yes`; CSP is `script-src 'self' 'wasm-unsafe-eval'` without `unsafe-inline`.

## Tested matrix

| SR + Browser | Coverage |
|---|---|
| NVDA + Firefox / Chrome (Windows) | Primary — axe `test:a11y` runs Chromium; manual NVDA pass recommended per release |
| JAWS + Chrome (Windows) | Spot-check heading order, live regions |
| VoiceOver + Safari (macOS / iOS) | Route focus + reduced-motion |
| TalkBack + Chrome (Android) | Touch Explorer haptics gate (`platform.supportsVibration`) |

CI: `pwa/tests/a11y.spec.ts` via `@axe-core/playwright` — job `a11y` (`needs: pwa`) in `.github/workflows/ci.yml:40-74` — 13 routes, **83/83 passed** at `v0.1.0` (`32696458912`). Expand to loaded-article fixtures (P1-6 in research report).

## Known gaps (from audit, honest)

12 gaps tracked in `docs/research/oss-release-research.md` §3.2; 2 P0 closed in `v0.1.0`. Open high-impact: heading `h1→h2→h3` monotonicity, focus return on dialog close, Settings `role=switch` for toggles, `DOMPurify` attribute stripping for Reader, camera `aria-busy`. P1 roadmap in `ROADMAP.md`.

## How to report an accessibility bug

Use **Bug report** template (`.github/ISSUE_TEMPLATE/bug_report.yml`): include SR/browser, steps, expected announcement vs actual, `axe` log if present. Label `a11y`. We treat focus/keyboard/live-region regressions as P0.

## References

- W3C WCAG 2.2 (2023-10-05), WAI-ARIA APG (Dialog, Switch, Live Region)
- WebAIM Screen Reader Survey #10, USB-IF HID 0x41 (for future HID work)
- `docs/hardware-honesty.md` — relay vs driver (trust is an accessibility property)
