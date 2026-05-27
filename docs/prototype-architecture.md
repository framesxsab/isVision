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

- Plain text (Tactile Lab textarea — shipped)
- Clipboard paste (Tactile Lab — shipped)
- Local `.txt` / `.md` files (Tactile Lab — shipped)
- Cross-module handoff: Reader → Tactile Lab via `sessionStorage` (shipped)
- Future: integration with external screen readers (NVDA / JAWS / VoiceOver).
  A PWA can't reach those directly from the browser sandbox; this is parked
  until we have a companion native helper.

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

The Tactile Lab also exposes a "Send to HID braille display" path that uses
WebHID (`navigator.hid`) with the standard Braille Display usage filter
(usage page 0x41, usage 0x01) and writes a flat output report of cell masks.
This is a scaffold — verified end-to-end only with stub devices in unit
tests; live verification still requires a commercial display.

BRLTTY driver integration is now wired up as an OS-side helper:
`tools/tactile_serve.py` parses the compact protocol the PWA emits and
dispatches each frame to one of:

- `stdout` — pretty-prints the event stream (debug; no extra deps)
- `serial:<port>` — relays the protocol byte-for-byte over `pyserial`
- `brltty` — talks to a running BRLTTY daemon via BrlAPI (`python3-brlapi`),
  writing each frame's dot masks as a `writeDots` buffer sized to the
  connected display. Any BRLTTY-supported braille display can act as the
  prototype's output surface this way.

Typical pipeline from a saved PWA export:

```bash
python tools/tactile_serve.py --file frames.txt --out brltty
python tools/tactile_serve.py --file frames.txt --out serial:COM5
```

`pyserial` and `brlapi` are imported lazily, so the script (and its tests)
runs fine on a box that has neither installed — only the chosen sink needs
its backing library.

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
- **Grade 2 (Liblouis)** — served via the liblouis-js Easy-API running in a
  Web Worker. The ~1.6 MB WASM build and the table set are kept out of the
  install-time precache and fetched on first use; once cached they work
  offline. A language selector switches between English UEB (contracted),
  Français (BFU Grade 2), and Deutsch (Kurzschrift Grade 2).

Adding another language means appending its `.ctb` / `.cti` / `.uti` / `.dis`
dependency closure to `scripts/copy-liblouis-assets.mjs`, registering it in
`LIBLOUIS_TABLES` in `liblouisAdapter.ts`, and adding one row to
`LANGUAGE_OPTIONS` in `TactileOutputPage.tsx`.

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

The `/tactile-drill` page in the PWA wraps all six tasks below in a drill
loop with attempt + accuracy + streak counters. Each task is selectable as a
mode (letter / word / number / mixed), and a speech-mode toggle covers the
speech-only vs speech-plus-tactile comparison.

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
