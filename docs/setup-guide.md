# Setup Guide

How to install isVisible for end users and how to provision the PWA + firmware for a school, makerspace, or accessibility lab. This is the Phase 5 packaging deliverable: a reproducible open-source assistive technology kit.

## What you get

- A **Progressive Web App** (`pwa/`) that can be installed on desktop or Android and works offline once the braille tables are cached.
- A **single-cell or multi-cell Arduino firmware** that renders braille and low-resolution tactile graphics from the app over USB serial.
- A **Python bridge** (`tools/`) that relays frames from files or stdin to a serial board or a BRLTTY-driven display.

You do not need all three to be useful: the PWA alone gives the Touch Explorer, AI Vision, Reader, Voice Navigation, and the Tactile Lab with its simulated display. Hardware turns the simulated pins into real raised ones.

## Web app install (end users)

1. Build and serve the PWA (see below) or open the hosted instance in a Chromium-based browser (Chrome, Edge, Brave).
2. Complete the onboarding flow — it walks through the capability check, microphone, and (optional) camera permissions.
3. Tap the install prompt in the address bar, or use the browser menu → **Install isVisible**. The app installs as a standalone, offline-capable app.
4. Before going offline, open **Settings → Offline readiness** and press **Cache language tables** so Grade 2 translation keeps working without a network.

The app stores its state under `isvisible-settings` and `isvisible-tactile` in localStorage; both survive a browser restart.

## Run the web app yourself (lab / server)

```text
git clone https://github.com/framesxsab/isVision.git
cd isVision/pwa
npm install
npm run build         # type-check, bundle, and copy liblouis assets
npm run preview       # serve the production build, default http://localhost:4173
```

For development with hot reload:

```text
npm run dev           # http://localhost:5173
```

Required environment variables live in `.env` (copy from `.env.example`); the build checks for secret leakage via `npm run check-env`.

## Build a hardware prototype (makerspace)

### Single cell (Phase 2)

See [firmware/single-cell-arduino/README.md](../firmware/single-cell-arduino/README.md) for the wiring, BOM, and build commands. One six-dot cell, driven over the compact protocol. Smoke test from the Tactile Lab: select **Compact**, connect the board over Web Serial, press **Send**.

### Cell strip (Phase 3)

See [firmware/cell-strip-arduino/README.md](../firmware/cell-strip-arduino/README.md) for a 4–8-cell strip on 74HC595 shift registers with navigation buttons and a braille keyboard. The strip reports button presses and typed dots back over the same serial wire as `IN` lines.

### Tactile graphics (Phase 4)

Open **Tactile Graphics** in the app, upload a chart or diagram (bold black shapes on white convert best), adjust the grid size and ink threshold, and send the resulting frames to the strip over serial or to an HID braille display.

## Bridge a real braille display (no custom hardware)

If you already own a BRLTTY-compatible braille display, the Python bridge can drive it from the app's compact protocol:

```text
sudo apt install python3-brlapi
python tools/tactile_serve.py --out brltty --file frames.txt
```

See [docs/integration.md](integration.md) for the full integration matrix (NVDA, BRLTTY/BrlAPI, WebHID, serial).

## Provisioning a lab

1. Set up one machine as the build/server host for the PWA (or use the hosted instance).
2. Flash the strip firmware onto one Arduino per workstation, and wire the strip.
3. On each workstation, install the PWA and grant Web Serial access to the Arduino when the Tactile Lab requests the port.
4. Under **Settings**, recommend users cache language tables and pick a speech voice before going offline.
5. Keep `docs/setup-guide.md` and `docs/integration.md` printed or available online near each station.

## Verification checklist

Run from the repository root before deploying:

```text
npm --prefix pwa run verify         # vitest unit tests (must be green)
npm --prefix pwa run test:a11y      # Playwright + axe suite against the build
python -m unittest discover -s tests # Python bridge tests
npm --prefix pwa run audit:mobile    # tap-target + overflow audit (needs `npm run dev` on 5173)
```

All four should pass. The bridge and firmware protocol tests also run in CI.