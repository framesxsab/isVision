# Roadmap — isVisible

> This file badges the original `docs/roadmap.md` phases 0–5 with `Status` so newcomers are not misled. Original phrasing preserved; see `docs/roadmap.md` for the verbatim plan.

| Phase | Goal | Status | Shipped in | Next PR (P0→P1) |
|---|---|---|---|---|
| **0 — Community & validation** | Interviews (12), workflows, 2 recurring problems, safety constraints | 🟡 Research | brief `docs/user-problem-brief.md:62-68` is hypothesis | `docs/research/field-notes.md` protocol (Phase 4) — no fabricated data |
| **1 — Software tactile renderer** | Liblouis frames + sim display + serial + keyboard/SR UI | 🟢 Done | `v0.1.0` (`brailleFrames`, `liblouisAdapter`, `HardwareEmulatorPage`, `tactile_serve`) | — |
| **2 — One-cell hardware** | 6/8-dot cell, MCU, latency/noise/heat/durability | 🟠 Prototype | `firmware/single-cell-arduino/` | `firmware/measurements.md` table for 51-57 constraints |
| **3 — 4–8-cell strip** | Multiple cells, nav buttons, braille keyboard, USB HID explore | 🟠 Prototype | `firmware/cell-strip-arduino/` (74HC595, `IN` lines) | parser fuzzer + 10 wpm sustained proof |
| **4 — Spatial tactile output** | SVG/bitmap → lines/regions, charts/grids/maps/math | 🟡 Research + prototype | `TactileGraphicsPage` + `graphicsConverter.ts` | scale legend + N=5 pilot (P2-4) |
| **5 — Integration** | NVDA/BRLTTY/Narrator/TalkBack/VoiceOver, doc formats, kit packaging | 🟠 Prototype (relay only) | `tactile_serve --out brltty` relays via `writeDots` | NVDA add-on spike *or* HID descriptor — keep relay honesty |

## Milestones (semver)

- **v0.1.0** `2026-08-24` — MIT LICENSE, governance, P0 a11y (Touch Explorer role + reduced-motion), hardware honesty, CI 83/83 — https://github.com/framesxsab/isVision/releases/tag/v0.1.0 — commit `e786794`
- **v0.2.0** (this branch `v0.2.0-prep`) — handoff + polish: `ACCESSIBILITY.md`, `ARCHITECTURE.md`, `DESIGN_SYSTEM.md`, `API.md`, `HARDWARE.md`, `FIELD_STUDY_PROTOCOL.md`, UX refinements, leaderboard hooks, `GOOD_FIRST_ISSUES.md` + 20 issues, full verify pipeline
- **v0.3.0** — field study: N=5–12 Task timing + SUS + anonymized `field-notes.md` (no fabricated participants), P2 tactile improvements (mistakes queue, extra Liblouis tables)

## Version strategy

Semver, conventional commits. Tags `v*` trigger `.github/workflows/release.yml` (build + generate-notes + attach `pwa/dist`). See `CHANGELOG.md` (Keep a Changelog).

## How this doc relates to `docs/roadmap.md`

`docs/roadmap.md` is the frozen Phase 0–5 charter (79 lines). This file is the live badge board that tracks it — edit this file when a phase moves, not the charter.
