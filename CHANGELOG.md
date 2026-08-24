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

## [Unreleased] — v0.2.0-prep (branch `v0.2.0-prep`)

### Added (this branch, Phase 1)
- `ACCESSIBILITY.md` — WCAG 2.2 AA stance, tested matrix, CI, gap list
- `ARCHITECTURE.md` — mermaid system map, 7 modules, data flows, folder map
- `HARDWARE.md` — kit vs product, safety constraints table, BOM hints
- `ROADMAP.md` — status-badged Phases 0–5, v0.1.0 → v0.3.0 milestones
- `API.md` — reader/liblouis/voice/protocol/bridge/settings keys
- `DESIGN_SYSTEM.md` — tokens, Button/Card/PageShell primitives, additive rules
- `RESEARCH.md` — artifact index, citation, reproducibility
- `FIELD_STUDY_PROTOCOL.md` — N=12, consent, SUS, task timing (no fabricated data)
- `CONTRIBUTOR_GUIDE.md` — 5-minute onboarding
- `.github/CODEOWNERS`, `FUNDING.yml`, `labels.yml`, `release.yml` (tag → build + release)

[0.1.0]: https://github.com/framesxsab/isVision/releases/tag/v0.1.0
