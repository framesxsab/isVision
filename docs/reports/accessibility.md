# Accessibility Report — v0.2.0-prep

Target WCAG 2.2 AA. Baseline audit `docs/research/oss-release-research.md` §3 (12 gaps, 2 closed in v0.1.0).

## Shipped

- **P0 v0.1.0:** Touch Explorer `role=application→region` + arrows virtual cursor (2.1.1/2.5.7), reduced-motion kill-switch (2.3.3, `pwa/src/index.css:119-128`).
- **P1 v0.2.0-prep Phase 2:** FocusTrap trigger restore (2.4.3, `FocusTrap.tsx`), ToggleRow `role=switch` + `focus-within` (4.1.2, `SettingsPage.tsx`), contentCleaner `role/tabindex` forbid + `aria-*` strip (4.1.1, `contentCleaner.ts` + hook).
- **Phase 3 leaderboard (additive):** `useFocusReturn.ts`, `LiveRegion.tsx` TranscriptRegion (polite live + sr-only ol), `AccessibleSvg.tsx` (decorative vs titled), `headingValidator.ts` (one h1, no skipped level, 1.3.1/2.4.6).

## Tested

- CI `a11y` job `needs: pwa` — `@axe-core/playwright` 13 routes, 83/83 passed at v0.1.0 (32696458912). Phase 2/3 build 212 vitest + 32 python green (this branch pre-reports, re-run in final verify).
- `ACCESSIBILITY.md` matrix: NVDA+Firefox/Chrome primary, JAWS, VoiceOver, TalkBack + haptics gate.

## Remaining

- Heading validator gate in CI (issue 02), Vision `aria-busy` (01), alt helper + markdown helper (12/13), keyboard regression spec (14), offline hero honesty (15) — all in `.github/issues/` + `docs/issues/` with good-first labels.

## How to verify

`cd pwa && npm run verify` (build + test + test:a11y) + manual NVDA/VoiceOver pass per `ACCESSIBILITY.md`.
