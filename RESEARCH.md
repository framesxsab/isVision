# Research — isVisible

> isVisible is **research-ready, not research-claimed**. Nothing is validated by fabricated participants. This index is the citation source of truth; every claim in docs carries `[Source N]` or a file:line.

## Questions the project is built to answer

- Do blind/low-vision users recover layout (tables, code, headings) faster with tactile frames than speech alone? (`user-problem-brief.md` problem 1)
- Are tactile graphics usable when generated as low-resolution pin matrices without an embosser? (problem 2)
- Does a sub-$30 single cell improve braille literacy on-ramp vs phone vibration? (problem 3, Drill)
- See `docs/research/oss-release-research.md` §2 for the digital-transformation argument and §7 for ecosystem positioning.

## Artifacts (status is load-bearing)

| Artifact | Path | Status | Backs |
|---|---|---|---|
| User problem brief (hypothesis, N=12 plan, safety constraints) | `docs/user-problem-brief.md` | 🟡 Hypothesis — interviews not yet run (`:62-68`) | Phases 0, 2–3 |
| Prototype architecture | `docs/prototype-architecture.md` | Prototype | ARCHITECTURE.md |
| Tactile protocol v1 | `docs/tactile-protocol.md` + `src/isvisible/protocol.py` | Shipped | HARDWARE.md, API.md |
| OSS release audit (12 a11y gaps, 7 modules, checklist) | `docs/research/oss-release-research.md` (326 lines) | Shipped 2026-08-24 | ACCESSIBILITY.md, ROADMAP.md |
| Hardware honesty (relay vs driver) | `docs/hardware-honesty.md` | Shipped v0.1.0 | HARDWARE.md |
| Research notes | `docs/research-notes.md` | Notes | — |
| Field study protocol | `FIELD_STUDY_PROTOCOL.md` | Shipped (this branch) | Phase 0 validation |
| Future field notes | `docs/research/field-notes.md` (planned) | **Not yet — no participants invented** | v0.3.0 milestone |

## How to cite

Cite the *artifact*, not the README. Example: `isVisible Tactile Protocol v1 (docs/tactile-protocol.md + src/isvisible/protocol.py CFG/F/B/END)`. For a11y claims, cite `ACCESSIBILITY.md` + `AriaLive.tsx:24-39` or `a11y.spec.ts` route.

## Reproducibility

- PWA: `cd pwa && npm ci && npm run verify` (`build && test && test:a11y`) — CI job `pwa` + `a11y` (needs `pwa`) in `.github/workflows/ci.yml:13-74`.
- Bridges: `python -m unittest discover -s tests` (job `bridge` `:76-87`).
- Frames: `python tools/braille_stream.py "Hello" --unicode | python tools/tactile_serve.py --out stdout --no-sleep`.

## Honesty rule

Never add participant quotes, SUS scores, or timing sheets without a committed `field-notes.md` that records anonymized dates and methods. `FIELD_STUDY_PROTOCOL.md` is the gate.

## Next study

`FIELD_STUDY_PROTOCOL.md` defines N=12 (6 braille, 4 non-braille SR, 2 graphics) to confirm 2/3 load-bearing problems. Until it runs, roadmap Phase 0 remains 🟡.
