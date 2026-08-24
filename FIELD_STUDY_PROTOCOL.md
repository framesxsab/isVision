# Field Study Protocol — isVisible

> **Ethics:** Voluntary, informed consent, anonymized, no fabricated data. Do not commit participant PII. This protocol gates `docs/research/field-notes.md`.

## Participants (N=12)

- **Braille readers (6):** daily contracted braille + refreshable display users — "moments display is not enough" (`user-problem-brief.md:18-21`).
- **Non-braille SR users (4):** speech-only, incl. late-onset — where speech is too slow/dense (`:22`).
- **Tactile graphics users (2):** students/scientists handling raised-line/3D/swell (`:23`).

## Load-bearing problems to confirm (need 4/12 quotes each)

1. **Layout invisible with audio alone** (tables/code/columns) — `user-problem-brief.md:41`.
2. **Graphics scarce/slow** (emboss hours, most material absent) — `:42`.
3. **Glanceable cues missing** (single-cell faster than sentence) — `:44`.

## Workflows to probe (walk-through, not abstract — `:26-35`)

Reading (long-form, textbooks, code, email), coding/studying (indentation, tables, equations), browsing/banking (forms, confirmations), maps/transit, diagrams (charts, circuits, molecules), messaging/terminals (status cues).

## Session (60 min, per participant)

1. **Consent (5 m)** — form `docs/research/consent.template.md` (to be added Phase 4), anonymized ID `P01…P12`, withdraw anytime.
2. **Workflow walk-through (25 m)** — 3 workflows above, capture verbatim problem quote.
3. **Task timing (20 m)** — 3 tasks on isVisible PWA on their device: (A) Reader article → Send to Tactile Lab, (B) Drill 5 letters, (C) Touch Explorer vs OS explore on same page. Record `task_id, start, end, success, assist, notes` in `docs/research/task_timing.template.csv` (Phase 4 schema, not invented rows).
4. **SUS (5 m)** — 10-item System Usability Scale (`docs/research/sus.template.md` Phase 4).
5. **Debrief (5 m)** — "what would make this useful tomorrow?"

## Safety & comfort (hardware pilots only)

Constraints `user-problem-brief.md:51-57` — 0.5–0.7 mm protrusion, <0.3 N, 2.5 mm pitch, <50 ms, <41 °C, <45 dBA, no pinch/HV. Collect `firmware/measurements.md`.

## Data handling

- Store raw CSV local under `docs/research/` with IDs only; commit **anonymized** `field-notes.md` (quotes, SUS aggregates, timing medians, not PII).
- Never commit audio/video without explicit consent and local-only retention note.
- Script `tools/anonymize_field_notes.py` (Phase 4) strips names/emails.

## Deliverable

`docs/research/field-notes.md` with per-problem quote table (4+ quotes to confirm) + per-task timing summary + SUS mean. Until that file exists, `RESEARCH.md` remains honest that Phase 0 is hypothesis.

## Why 12?

Grounds the `roadmap.md` Phase 0 deliverable ("at least 2 problems confirmed") without over-claiming statistical power — this is formative, not summative.

## SUS questionnaire (Phase 4 template)

Items 1–10 incl. "I felt confident using isVisible" — score 0–100 per Brooke. See `docs/research/sus.template.md` (planned, not yet invented).
