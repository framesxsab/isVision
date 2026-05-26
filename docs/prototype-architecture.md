# Prototype Architecture

## System overview

```text
Text / document / UI summary
        |
        v
Braille translator and tactile renderer
        |
        v
Frame protocol
        |
        v
Microcontroller
        |
        v
Pin actuators under fingertip
```

## Software modules

### Input adapters

- Plain text
- Clipboard
- Local files
- Future: screen reader or accessibility tree integration

### Translation

- Use Liblouis for braille translation.
- Keep a debug mode that shows raw dot patterns.
- Support multiple languages later; do not hard-code English-only assumptions into the frame format.

### Frame model

Each output frame should include:

- `cells`: array of braille dot bitmasks
- `cursor`: optional focused cell index
- `mode`: text, command, status, diagram, or training
- `label`: optional accessible description for the current frame

Example:

```json
{
  "mode": "text",
  "cells": [1, 3, 9, 25],
  "cursor": 0,
  "label": "word start"
}
```

### Device protocol

Start with simple serial JSON lines for fast prototyping:

```json
{"type":"frame","cells":[1],"duration_ms":0}
{"type":"button","name":"next"}
```

Later, move toward USB HID braille or a BRLTTY driver when the hardware behavior is stable.

## PWA tactile lab

The PWA includes a first implementation of this pipeline at `/tactile-output`.

Current capabilities:

- Convert text into six-dot debug braille cells.
- Group cells into 1-cell, 4-cell, or 8-cell tactile frames.
- Preview braille Unicode and individual dot positions.
- Copy or save JSON Lines for firmware testing.
- Send frames over Web Serial at 115200 baud in supported Chromium browsers.

The Tactile Lab now exposes two translators:

- **Grade 1 (debug)** — the bundled in-process mapping. Sync, ships with the
  initial JS, used for tests and as the fallback when Liblouis can't load.
- **Grade 2 (Liblouis)** — Unified English Braille contracted, served via the
  liblouis-js Easy-API running in a Web Worker. The ~1.6 MB WASM build and
  the UEB table set are kept out of the install-time precache and fetched on
  first use; once cached they work offline.

Adding a new table set (e.g. another language) means appending its files to
`scripts/copy-liblouis-assets.mjs` and adding a second mode to
`TactileOutputPage`.

## Hardware modules

### One-cell prototype

Options to investigate:

- Micro servos: easy to prototype, but bulky/noisy.
- Solenoids: direct motion, but power and heat need care.
- Piezo actuators: closer to commercial displays, but cost and mechanics are harder.
- Shape-memory alloy: compact, but slow and heat-sensitive.

### Required constraints

- Dots must be stable under finger pressure.
- Dot spacing should follow standard braille ergonomics as closely as the prototype allows.
- No hot surfaces near the finger.
- Actuation should be quiet enough for classroom/work use.
- Failure mode should be safe: pins lower or power cuts off.

## Test tasks

- Identify single letters.
- Read short words.
- Read numbers and punctuation.
- Navigate forward/backward.
- Repeat current cell.
- Compare speech-only vs speech plus tactile output.

## Open questions

- Should the first hardware use 6-dot or 8-dot braille?
- Which users should we optimize for first: students, programmers, deafblind users, or general screen reader users?
- Can we build a low-cost actuator cell that is durable enough for daily use?
- Is USB HID braille practical early, or should we start with serial and integrate later?
