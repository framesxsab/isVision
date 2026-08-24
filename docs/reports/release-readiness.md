# Release Readiness — v0.3.0 hardening (v0.2.0-prep branch)

## Changed files (v0.1.0 e786794..HEAD, additive only)
- HID: `hidDevice.ts` + deviceManager import (69 lines)
- Accessibility: `a11y.spec.ts` headingValidator gate, `Icons.tsx` 3× AccessibleSvg, `altHelper.ts`, `markdownHelper.ts`
- Tests: `registry.marketplace.test.ts` 7, `hidDevice.test.ts` 4, `ResearchPlayground.research.test.ts` 5, coverage config
- Docs: `MANUAL_HID_VALIDATION.md`, `DEMO.md`, this report

## Architecture impact
- Plugin.ts, protocol.py, tactile_serve.py preserved — zero breaking changes
- Registry/DeviceManager source of truth kept, new HID plugin additive

## Tests
- `npm run verify`: build ✓, 232 vitest (19 files) ✓, 83 e2e (axe 13/13) ✓
- `python -m unittest`: 32 OK
- New HID/marketplace/research tests cover failure/empty/disabled/unsupported

## Accessibility
- WCAG 2.2 AA: headingValidator gated, AccessibleSvg strategy, altHelper, keyboard shortcuts registry, transcript everywhere, reduced-motion kill-switch
- Axe 13 routes, 83 passed at v0.1.0, heading gate now adds 13 checks

## CI
- `ci.yml`: concurrency, coverage (Codecov, fail_ci_if_error false), artifacts (pwa-dist, Playwright, python)
- `lighthouse.yml`: Lighthouse CI on /, /reader, /device-diagnostics
- `release.yml`: semver tag v* → build → artifact → generate-notes
- `pr-quality.yml`: semantic title

## Known limitations
- Physical HID Braille not verified — see `MANUAL_HID_VALIDATION.md` MANUAL/NOT YET VERIFIED
- Headings: Home/Onboarding have h1, but future pages must keep one h1 — gate will fail PRs that break
- Coverage: vitest --coverage config added but @vitest/coverage-v8 not installed — CI fallback echo, not chasing number

## Manual validation required
- HID: steps 1-5 in MANUAL_HID_VALIDATION.md with real Braille display + Chrome
- Field study: N=5 pilot via Research playground (consent, randomization, SUS, CSV) — templates ready, no participants invented

## Exact release blockers
- None for `v0.3.0` as software platform (emulated/virtual). Physical HID is MANUAL, not a blocker.
- If headingValidator fails on a new route, fix h1 count before tag.

## Recommended version
- `v0.3.0` — production platform (plug-and-play, a11y hardened, research ready, demo deterministic). Tag from `v0.2.0-prep` HEAD after final push.
