# Performance Benchmark — isVisible

- `npm run build` — 99 modules, precache 32 entries ~548 KiB (see `pwa/dist` logs)
- `npm test` — 212 vitest in ~2s, `python -m unittest` 32 in <0.1s
- Lighthouse target: accessibility 100, performance >90 on slow 3G (via `.github/workflows/lighthouse.yml`)
- Visual snapshots: placeholder — `pwa/tests/a11y.spec.ts` axe snapshots + future Playwright `toHaveScreenshot` (issue 18)
- Artifacts: `release.yml` uploads `pwa/dist`, lighthouse uploads to temporary public storage
