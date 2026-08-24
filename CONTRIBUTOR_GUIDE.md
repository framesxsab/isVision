# Contributor Guide — isVisible (5-minute path)

> For the full rules see `CONTRIBUTING.md`. This is the *fast* handoff; `ARCHITECTURE.md` → `DESIGN_SYSTEM.md` → `API.md` → `ACCESSIBILITY.md` is the reading order.

## 5-minute onboarding

```bash
git clone https://github.com/framesxsab/isVision.git && cd isVision
git checkout v0.2.0-prep   # or main for v0.1.0
cd pwa && npm ci && npm run dev   # http://localhost:5173
# in a second shell:
cd pwa && npm run verify          # build && test && test:a11y (212 vitest, 83 e2e)
python -m unittest discover -s tests   # 32 bridge tests
```

Prereqs: Node >=20 (`engines` in `pwa/package.json:7-9`), Python 3.12, optional Arduino CLI for `firmware/`. No Docker needed for PWA; see `HARDWARE.md` for `tactile_serve` sinks.

## Docs index (read in order)

| Doc | What it answers |
|---|---|
| `ARCHITECTURE.md` | System map, 7 modules, data flows, folder map |
| `DESIGN_SYSTEM.md` | Tokens, Button/Card/PageShell, 44 px, focus, motion |
| `API.md` | `/api/reader/fetch`, protocol CFG/F/B/END, `tactile_serve` CLI |
| `ACCESSIBILITY.md` | WCAG 2.2 AA stance, live regions, skip, focus trap |
| `HARDWARE.md` + `docs/hardware-honesty.md` | Relay honesty, safety constraints |
| `RESEARCH.md` + `FIELD_STUDY_PROTOCOL.md` | What is validated vs prototype, how to run a study without fabricating |

## Picking a first issue

Open `GOOD_FIRST_ISSUES.md` (Phase 7, this branch) or `.github/ISSUE_TEMPLATE/*` — label `good first issue` + `a11y`/`docs`/`PWA`. Mentor notes in `HELP_WANTED.md`. Architecture walkthrough: `ARCHITECTURE.md` §Folder map + `pwa/src/App.tsx:22-29` routes.

## PR checklist (from `.github/pull_request_template.md`)

- Tests green (`npm run verify` + `python -m unittest`), axe route you touched, docs updated, no `VITE_*` secret (`npm run check-env`), `HARDWARE.md` honesty preserved, conventional commit.

## Where things live

- PWA `pwa/src/{core,components,pages,modules}` — reuse `Button`/`PageShell` before adding primitives.
- Protocol `src/isvisible/protocol.py` — single source of truth for `docs/tactile-protocol.md`.
- Bridges `tools/tactile_serve.py` (`stdout`/`serial`/`brltty` relay), `tools/braille_stream.py`.
- Firmware `firmware/single-cell-arduino`, `cell-strip-arduino` (prototype, see `HARDWARE.md` safety table).

## Getting help

`TroubleshootPage` (`/troubleshoot`) + `ACCESSIBILITY.md` reporting + Discussions (to be enabled, Phase 1 plumbing). Code owner `* @framesxsab` — `CODEOWNERS`.

See `ROADMAP.md` for v0.2.0 → v0.3.0 milestones and `CHANGELOG.md` for history.
