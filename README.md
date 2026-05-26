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

A fully functional Progressive Web App with 4 modules that blind users can use TODAY:

- **Touch Explorer** — Slide finger across screen to hear element descriptions with haptic vibration + spatial audio
- **AI Vision** — Camera capture → NVIDIA Vision AI → spoken description of anything
- **Accessible Reader** — Paste URL → clean article read aloud with play/pause/skip controls
- **Voice Navigation** — Push-to-talk voice commands across all modules

### Quick Start

```bash
cd pwa
npm install
npm run dev
```

Open http://localhost:5173 on your phone or desktop. See `pwa/` for full details.

### Tech

React + TypeScript + Vite PWA + Web Speech/Audio APIs + NVIDIA free AI endpoints

---

## Hardware Track — Tactile Braille Prototype

Generate prototype tactile frames:

```bash
python tools/braille_stream.py "Hello 123" --unicode --group-size 1
```

Run tests:

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

The PWA now includes a Tactile Output Lab at `/tactile-output`. It converts text
into braille cell frames, previews the dot patterns, exports JSON Lines, and can
send frames to a microcontroller through Web Serial in supported browsers.

Hardware starter:

- [Tactile protocol](docs/tactile-protocol.md)
- [Single-cell Arduino firmware](firmware/single-cell-arduino/README.md)
