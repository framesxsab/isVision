# User Problem Brief

Phase 0 deliverable: the recurring problems isVisible sets out to solve, grounded in real blind and low-vision workflows, plus the safety and comfort constraints fingertip hardware must meet. This brief is the input every later phase is validated against — if a design choice is not traceable back to a problem listed here, it should not ship.

## Why this brief exists

Before building hardware, we need to confirm we are solving a problem that exists, that recurs, and that current tools do not already handle. The brief records:

1. The workflows where tactile output would clearly help.
2. At least two recurring problems surfaced across interviews.
3. The safety and comfort constraints a refreshable fingertip cell must satisfy.

It is written to be falsifiable: each claim can be confirmed or overturned by a follow-up interview, and the constraints are measurable.

## Interview plan

Interview at least 12 people across three groups:

- **Braille readers** (6): people who read contracted braille fluently and use a refreshable display daily. Ask about the moments their display is not enough.
- **Non-braille screen reader users** (4): people who rely on synthesized speech but do not read braille, including users with late-onset vision loss. Ask where speech is too slow, too dense, or impossible to scan.
- **Tactile graphics users** (2): students, scientists, or blind professionals who handle raised-line diagrams, 3D prints, or swell paper. Ask how they currently obtain graphics and how long it takes.

For each interview, capture the workflow in the participant's words and anchor every problem statement to a quote.

## Real workflows to probe

Ask participants to walk through these workflows in detail, not in the abstract:

- **Reading** — long-form articles, textbooks, code, email. Where does skimming break down with only audio?
- **Coding and studying** — indentation, structure, tables, equations. What does a screen reader make invisible that braille would show?
- **Browsing and banking** — forms, transaction confirmations, multi-column layouts. Where does spatial layout matter?
- **Maps and transit** — routes, intersections, station layouts. How is orientation communicated now?
- **Diagrams** — charts, circuit diagrams, math, molecule diagrams. How often are these unavailable, and what is the work to convert them?
- **Messaging and terminals** — short, glanceable status. Where is a quick tactile cue faster than listening to a sentence?

## Recurring problems (targets)

Two recurring problems must be confirmed before hardware work begins. These are the load-bearing claims for Phases 2–4:

1. **Spatial layout is invisible with audio alone.** Skimming a table, a code block, or a paragraph's shape requires sequential listening; the structure is lost. Confirm at least 4 of 12 participants name "not being able to see layout" as a daily friction.
2. **Tactile graphics are scarce and slow to produce.** Raised-line diagrams take hours to emboss or print, so most material is unavailable. Confirm at least 4 of 12 participants report that diagrams they needed were simply absent.

A third, lower-priority problem is worth tracking:

3. **Glanceable status cues are missing.** Notifications, connection state, and progress are spoken in full sentences when a single-cell cue would do. This motivates the single-cell prototype in Phase 2.

## Safety and comfort constraints

A fingertip refreshable cell huristically feels commercially implausible unless it is comfortable to press and to rest a finger on for minutes. These constraints are measurable and must be met by the Phase 3 strip:

- **Pin protrusion height:** 0.5–0.7 mm. Below 0.5 mm is hard to distinguish by touch; above 0.7 mm can scratch or fatigue the fingertip.
- **Actuation force:** the cell should not require more than 0.3 N to read comfortably and should never exceed 0.5 N. Higher force causes finger fatigue within two minutes of reading.
- **Pin-to-pin pitch:** standard braille pitch is 2.5 mm horizontally and 2.5 mm vertically in a cell; cells are 6.2 mm apart. Match this so braille from the cell is recognizable to existing braille readers.
- **Pin settle time:** under 50 ms from command to rest. Above this, fast readers outpace the cell and the display "stutters".
- **Surface temperature:** the cell and surrounding surface must not exceed 41 °C under continuous use. Driver heat must be dissipated, not conducted to the finger.
- **Noise:** under 45 dBA at 30 cm. Solenoid clicks above this are fatiguing in a quiet room and unusable in a library or classroom.
- **No exposed high voltage; no pinching gaps.** Moving parts must not trap a fingertip resting on them.

These constraints are referenced by the firmware (hold_ms bounds, shift-register drive) and by any future actuator selection.

## Validated outcomes

Phase 0 is "done" when:

- At least 2 recurring problems are confirmed with quotes from at least 4 participants each.
- The 7 safety/comfort constraints above are accepted as design requirements by the engineering team.
- A user problem brief with real workflows and quotes is committed under `docs/`.

Until those interviews are run, this brief documents the assumptions the prototype is built on — they are the hypothesis, not yet the finding.