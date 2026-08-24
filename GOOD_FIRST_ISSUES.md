# Good First Issues — isVisible

Curated for new contributors — each is isolated, testable, and mentored. See `CONTRIBUTOR_GUIDE.md` 5-min path + `ARCHITECTURE.md`.

| # | Title | Area | Mentor note |
|---|---|---|---|
| 1 | Add `aria-busy` to VisionAssistant video while analyzing | PWA a11y | `VisionAssistantPage.tsx` + `useVisionAssistant.ts:analyzing` |
| 2 | Add heading validator to CI (one `h1`, no skipped level) | a11y | `headingValidator.ts` → `a11y.spec.ts` |
| 3 | Replace ad-hoc SVGs with `AccessibleSvg` (3 icons) | PWA | `components/Icons.tsx` |
| 4 | Add `focus-within` ring audit for remaining toggles | a11y | `SettingsPage` pattern now, audit other panels |
| 5 | Stripe `role`/`aria-*` in one more cleaner test | Reader | `contentCleaner.test.ts` if exists, else add |
| 6 | Document `holdMs` bounds in Settings (50–2000 ms) | tactile | `tactileStore.ts` + `SettingsPage` |
| 7 | Add `docs/research/templates` checklist to CONTRIBUTING | docs | `CONTRIBUTING.md` |
| 8 | Add Docker `healthcheck` for Vite preview | DX | `Dockerfile` |
| 9 | Add `npm run dep:health` script (npm audit + pip-audit) | DX | `pwa/package.json` |

Full 20 in `.github/issues/` and `docs/issues/` — pick one, comment "I’ll take #N", PR against `v0.2.0-prep`.
