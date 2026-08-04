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
- [User problem brief](docs/user-problem-brief.md)
- [Setup guide](docs/setup-guide.md)
- [OS integration](docs/integration.md)
- [Tactile protocol](docs/tactile-protocol.md)

## PWA — Software Accessibility Platform

A fully functional Progressive Web App with seven modules:

- **Touch Explorer** — Slide a finger across the screen to hear element descriptions with haptic vibration and spatial audio.
- **AI Vision** — Camera capture → vision model → spoken description.
- **Accessible Reader** — Paste a URL → clean article read aloud with play/pause/skip controls. Sends the current paragraph to the Tactile Lab in one click.
- **Voice Navigation** — Push-to-talk voice commands across every module, including `tactile drill` and `braille lab`.
- **Tactile Output Lab** — Convert text into braille cell frames (Grade 1 debug or Liblouis Grade 2 in English UEB / French / German). Stream them over Web Serial or WebHID, or export JSON Lines / compact protocol for downstream firmware.
- **Tactile Drill** — Practice letters, words, numbers, and punctuation across three difficulty levels. Tracks score, streak, and per-attempt history. Export your session as CSV.
- **Tactile Graphics** — Turn a chart, map, or diagram into a low-resolution tactile pin matrix that plays on a braille-cell display. Dark areas become raised pins; the app segments them into labeled regions and emits compact-protocol frames for the same hardware as braille text.

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

Two Arduino firmware targets accept the compact protocol the PWA emits:

- [firmware/single-cell-arduino/](firmware/single-cell-arduino/) — one six-dot braille cell (Phase 2).
- [firmware/cell-strip-arduino/](firmware/cell-strip-arduino/) — a 4–8-cell strip on 74HC595 shift registers with navigation buttons and a braille keyboard that report back as `IN` input lines (Phase 3).

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

## Deploying to Cloudflare Workers

The PWA ships as static assets served by a Cloudflare Worker. `wrangler.jsonc` at the repo root points `assets.directory` at `pwa/dist`, so a build has to run before `wrangler deploy`.

**Cloudflare Workers Builds (dashboard CI) silently ignores the `build` field in `wrangler.jsonc`.** Configure the build in the dashboard instead:

- Workers & Pages → `isvision` → Settings → Build → Build Configuration
  - Build command: `cd pwa && npm ci && npm run build`
  - Deploy command: `npx wrangler deploy` (default)
  - Root directory: leave empty — moving it breaks wrangler's lookup for `wrangler.jsonc`

Local one-shot deploy:

```bash
cd pwa && npm ci && npm run build
cd .. && npx wrangler deploy
```

### Production security headers

`pwa/public/_headers` is copied into `pwa/dist/` at build time and applied by Cloudflare. It sets `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a camera/mic-only `Permissions-Policy`, and a header-delivered `frame-ancestors 'none'`. `frame-ancestors` in `<meta>` is browser-ignored, so it has to live in the header file.

### CSP and inline scripts

`pwa/index.html` declares `script-src 'self' 'wasm-unsafe-eval'` with no `'unsafe-inline'` or hash. Anything that must run before the React bundle parses goes in `pwa/public/` and is referenced via `<script src="/file.js">`. See `pwa/public/prelaunch.js` for the first-launch audio gate that unlocks `speechSynthesis` on first tap; it bails out under `navigator.webdriver` so Playwright runs aren't blocked by the modal.

Vite's dev server injects its own inline HMR modules, which would be blocked by that CSP. The `csp-dev-strip` plugin in `pwa/vite.config.ts` removes the meta CSP in `serve` mode only — production builds keep it intact.

Hardware starter (out of scope for the current software MVP; treated as a future phase):

- [Tactile protocol](docs/tactile-protocol.md)
- [Single-cell Arduino firmware](firmware/single-cell-arduino/README.md)
