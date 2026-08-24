# Contributor Report — v0.2.0-prep

## Onboarding (5 min)

`CONTRIBUTOR_GUIDE.md`: `git clone && cd pwa && npm ci && npm run dev` → `npm run verify` (build + 212 + 83 e2e) + `python -m unittest` (32). Prereqs Node 20 + Python 3.12. One-command `scripts/setup.mjs`, `Dockerfile`, `.devcontainer` (Phase 5).

## Docs

Index `docs/README.md` — 21 docs + 3 reports. Reading order `ARCHITECTURE → DESIGN_SYSTEM → API → ACCESSIBILITY → HARDWARE → RESEARCH → FIELD_STUDY`.

## First issues

`GOOD_FIRST_ISSUES.md` (9) + `.github/issues/` + `docs/issues/` (20 markdown-only). `HELP_WANTED.md` deeper tracks (braille tables, HID spike, graphics pilot, coverage). Labels `a11y`, `good first issue`, `help wanted`, etc. in `.github/labels.yml`.

## Ownership

`CODEOWNERS` → `* @framesxsab` + per-module comments. No CODEOWNERS bypass yet — keep additive. Release ` .github/workflows/release.yml` on `v*` (build + artifact + generate-notes).

## What is honest

- No fabricated participants — `REPRODUCIBILITY.md` + `anonymize_field_notes.py` gate, `field-notes.md` not yet exists.
- BRLTTY remains relay — `HARDWARE.md` + `TACTILE_PLUGIN.md` plugin interface for future sinks.
- `v0.1.0` tag immutable (e786794) — this branch does not rewrite it.

## Next PRs (from ROADMAP v0.2.0→v0.3.0)

1. Heading validator CI gate (02) 2. Coverage (18) 3. Graphics pilot N=5 4. Extra liblouis tables (19)
