# isVisible

An open, practical project to improve computer access for blind and low-vision users through tactile and non-visual interfaces.

## Project direction

The strongest direction is not to build a full tactile laptop screen first. That is a very hard hardware problem: real braille needs raised physical dots, and refreshable tactile graphics need dense moving pin arrays.

The first useful target is a smaller open prototype:

1. A software layer that turns text, documents, UI summaries, and simple graphics into braille/tactile frames.
2. A low-cost physical tactile module that can render one braille cell first, then a short strip, then simple tactile graphics.
3. A user-tested workflow that works with existing screen readers instead of trying to replace them.

The goal is to make a buildable path toward affordable tactile access, while respecting how blind users already work today.

## Core principles

- Build with blind and low-vision users from the beginning.
- Do not replace screen readers; integrate with NVDA, Narrator, TalkBack, VoiceOver, and BRLTTY where possible.
- Treat haptics as orientation and feedback unless it can produce real raised dots.
- Prefer standards and open components: USB HID braille, BRLTTY/BrlAPI, Liblouis, and accessible web/app patterns.
- Measure usefulness with real tasks: reading, editing, navigating, tables, math, diagrams, and code.

## First milestone

Prototype a single-cell tactile braille reader:

- Input: text from clipboard, typed text, file, or simple API.
- Translation: Liblouis-based braille translation where available.
- Output: serial frames to a microcontroller.
- Hardware: 6 or 8 actuated pins under one fingertip.
- Controls: next cell, previous cell, speed, pause, repeat, and mode switch.

This is small enough to build and test, but it teaches the real mechanical, electrical, software, and usability problems before scaling to a full tactile display.

## Docs

- [Research notes](docs/research-notes.md)
- [Roadmap](docs/roadmap.md)
- [Prototype architecture](docs/prototype-architecture.md)

## PWA — Software Accessibility Platform

A fully functional Progressive Web App with six modules:

- **Touch Explorer** — Slide a finger across the screen to hear element descriptions with haptic vibration and spatial audio.
- **AI Vision** — Camera capture → vision model → spoken description.
- **Accessible Reader** — Paste a URL → clean article read aloud with play/pause/skip controls. Sends the current paragraph to the Tactile Lab in one click.
- **Voice Navigation** — Push-to-talk voice commands across every module, including `tactile drill` and `braille lab`.
- **Tactile Output Lab** — Convert text into braille cell frames (Grade 1 debug or Liblouis Grade 2 in English UEB / French / German). Stream them over Web Serial or WebHID, or export JSON Lines / compact protocol for downstream firmware.
- **Tactile Drill** — Practice letters, words, numbers, and punctuation across three difficulty levels. Tracks score, streak, and per-attempt history. Export your session as CSV.

### Software-side features at a glance

- **Inputs into the Tactile Lab**: clipboard paste, .txt/.md upload, cross-module handoff from the Reader.
- **Multi-language Grade 2**: lazy-loaded Liblouis tables for English UEB, French BFU, and German Kurzschrift; ~1.6 MB WASM kept off the install precache.
- **Output**: serial JSON Lines, a compact firmware-friendly protocol, or WebHID writes to a braille-display class device.
- **Persistence** (`isvisible-tactile` localStorage key): translator/language/group size/output format/hold time/blank flag, last imported text + its source, drill mode/speech-mode/difficulty/score/last-100 attempts.
- **Offline readiness panel** in Settings: surfaces what's actually in the Cache Storage right now and exposes a "Cache language tables" button to prime tables before going offline.
- **Error recovery**: every Send / Paste button checks its underlying API (Web Serial, WebHID, clipboard read) and surfaces a concrete next step when it's missing. Liblouis failures show a Retry button.
- **Privacy disclosures** in Settings: eight rows covering clipboard, files, persisted state, speech I/O, AI Vision, Reader fetch, hardware bridges — each with a color-coded scope chip. A "Clear saved data" button wipes the per-page settings + drill history without re-triggering onboarding.

### Quick Start

```bash
cd pwa
npm install
npm run dev
```

Open http://localhost:5173 on your phone or desktop. See `pwa/` for full details.

### Tech

React + TypeScript + Vite PWA, Web Speech / Audio / Serial / HID APIs, zustand + persist, vite-plugin-pwa (workbox), Playwright + axe-core, Vitest, server-side fetch for Reader + AI providers (keys never reach the browser).

---

## OS-side bridge — `tactile_serve` CLI

The PWA emits a compact text protocol over Web Serial or as a downloadable file. `tools/tactile_serve.py` is the matching Python bridge that reads that protocol and dispatches frames to an OS-level sink:

```bash
# Pretty-print events (no extra deps)
python tools/tactile_serve.py --file frames.txt --out stdout

# Relay over a serial device (requires pyserial)
python tools/tactile_serve.py --file frames.txt --out serial:COM5

# Forward to a running BRLTTY daemon (requires python3-brlapi)
python tools/tactile_serve.py --file frames.txt --out brltty
```

`pyserial` and `brlapi` are imported lazily, so the script and its tests run on a machine that has neither installed.

## Hardware Track — Tactile Braille Prototype

Generate prototype tactile frames from the command line:

```bash
python tools/braille_stream.py "Hello 123" --unicode --group-size 1
```

Run the Python test suite:

```bash
python -m unittest discover -s tests
```

## PWA development

Run the frontend build check:

```bash
cd pwa
nvm use
npm run build
```

AI Vision uses a local API server so provider keys are not exposed in browser bundles:

```bash
cd pwa
nvm use
$env:NVIDIA_VISION_API_KEY="your-server-side-key"
npm run server
npm run dev
```

Run the full PWA test suite:

```bash
cd pwa
npm test          # Vitest — pure logic
npm run test:a11y # Playwright — routes, persistence, offline, axe
```

Hardware starter (out of scope for the current software MVP; treated as a future phase):

- [Tactile protocol](docs/tactile-protocol.md)
- [Single-cell Arduino firmware](firmware/single-cell-arduino/README.md)
