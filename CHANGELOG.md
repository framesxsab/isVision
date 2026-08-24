# Changelog — isVisible

All notable changes — Keep a Changelog (https://keepachangelog.com/en/1.0.0/), semver.

## [0.1.0] — 2026-08-24

### Added
- MIT LICENSE, CONTRIBUTING.md, CODE_OF_CONDUCT.md (Covenant v2.1), SECURITY.md
- Issue templates (bug_report.yml, feature_request.yml) + PR template
- Touch Explorer: `role=application` → `region`, keyboard fallback (arrows virtual cursor via elementFromPoint, Enter/Space, Esc), sr-only instructions
- Reduced-motion kill-switch (`index.css` unlayered cascade override)
- `docs/hardware-honesty.md` (BRLTTY relay honesty) + README link + `docs/development-improvement-spec.md` SHIPPED/ARCHIVED
- `docs/research/oss-release-research.md` (full audit, 12 a11y gaps, 7 modules, release checklist)

### Verified
- `npm run build` / `npm test` 212 / `python -m unittest` 32 / `check-env` / Playwright 83/83 (axe 13/13) — CI 32696458912 green
- Tag `v0.1.0` (e786794) — https://github.com/framesxsab/isVision/releases/tag/v0.1.0

### Changed
- `pwa/tests/touch-explorer.spec.ts` selector `application` → `region` for keyboard path

## [Unreleased] — v0.2.0-prep (branch `v0.2.0-prep`, now v0.3 excellence)

### Added (Phases 1-8 + v0.3 product excellence, additive only)
- Phase 1 docs: `ACCESSIBILITY.md`, `ARCHITECTURE.md`, `HARDWARE.md`, `ROADMAP.md`, `API.md`, `DESIGN_SYSTEM.md`, `RESEARCH.md`, `FIELD_STUDY_PROTOCOL.md`, `CONTRIBUTOR_GUIDE.md` + CODEOWNERS/FUNDING/labels/release.yml
- Reader excellence: `readingHelpers.ts` (sentence split, reading time, presets), `useReader` sentence nav (Alt+←/→, S/T), paragraph+sentence progress, TOC filter, cheat sheet, Esc home
- Tactile Lab: `previewZoom.tsx` (1x/1.5x/2x + ScaledPreview), `exportHistory.ts` (last-5 + Replay)
- Touch Explorer flagship: `regionStats.ts`, `RegionLegend`, `CalibrationPanel`, `TutorialPanel`, `HapticIntensityControl`, `PerfOverlay`, `SpatialAudio` 90ms ramp, `settingsStore` hapticIntensity 0.5/1/1.5 + v6 migrate
- A11y polish: `Skeleton.tsx` (motion-safe), aria-busy/empty role=status/error Try again, OfflineBanner polite, focus-visible, announcements
- Delight: `/shortcuts` page + `CommandPalette` (Cmd+K) + research playground `/research-playground`, Storybook config, module graph, coverage
- Plugin marketplace: `PLUGIN_ARCHITECTURE.md` + `MIGRATION_PLUGIN.md`, `registry` vcompat/enable/loadManifests, `deviceManager` hot-swap, `Mock/Virtual/BRLTTYRelay`, `manifest.schema.json`, `SDK.md`, `PLUGIN_GUIDE.md`, `create-plugin` scaffold, examples, `testing.ts`
- Reliability: `lighthouse.yml`, `PERF.md`, `COVERAGE.md` + `release.yml` artifacts
- Community: `GOOD_FIRST_ISSUES.md`, `HELP_WANTED.md`, 20 markdown issues in `.github/issues` + `docs/issues`

### Verified
- `npm run verify` (build + 216 vitest + 83 e2e axe) + `python 32` + `check-env` green on v0.3 branch

[0.1.0]: https://github.com/framesxsab/isVision/releases/tag/v0.1.0
