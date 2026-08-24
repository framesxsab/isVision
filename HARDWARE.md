# Hardware — isVisible

> **Honesty first:** isVisible's hardware is **prototype** (Phases 2–3). `tactile_serve --out brltty` is a **relay to a running BRLTTY daemon**, not a USB HID driver — `docs/hardware-honesty.md`. The PWA is shippable; hardware is a contributor kit.

## What exists

| Piece | Path | Status | Notes |
|---|---|---|---|
| PWA frames | `pwa/src/modules/tactile-output/brailleFrames.ts` + `liblouisAdapter.ts` + `graphicsConverter.ts` | Shipped | Grade 1 debug + Grade 2 UEB/FR/DE (WASM 1.6 MB lazy), compact v1 `CFG/F/B/END` + JSON Lines, `HardwareEmulatorPage` at `/hardware-emulator` |
| OS bridge | `tools/tactile_serve.py` | Shipped | `stdout` pretty-print, `serial:<port>` byte-for-byte relay (pyserial lazy), `brltty` via `brlapi.Connection().writeDots(bytes(cells))` in exclusive `enterTtyMode()` (`:160-218`) |
| Single-cell | `firmware/single-cell-arduino/` | Prototype | 6-dot cell, pins 2–7, compact consumer |
| Strip | `firmware/cell-strip-arduino/` | Prototype | 4–8 cells on 74HC595, nav buttons + braille keyboard → `IN` lines |

Protocol grammar: `src/isvisible/protocol.py` + `docs/tactile-protocol.md` — `CFG hold_ms=900 blank=1` (Settings default), `F <index> <cell_start> <masks>`, `B`, `END`. CLI: `python tools/braille_stream.py "Hello" --unicode --group-size 1` → `tools/tactile_serve.py --file frames.txt --out stdout|serial:COM5|brltty`.

## Safety & comfort constraints (from `docs/user-problem-brief.md:51-57`)

| Constraint | Target | Why |
|---|---|---|
| Pin protrusion | 0.5–0.7 mm | <0.5 mm indistinct, >0.7 mm scratches |
| Actuation force | <0.3 N (max 0.5 N) | >0.5 N fatigues in 2 min |
| Pitch | 2.5 mm dot, 6.2 mm cell | Braille standard |
| Settle | <50 ms | Otherwise stutters at speed |
| Surface temp | <41 °C continuous | Skin injury threshold |
| Noise | <45 dBA @30 cm | Library/classroom usable |
| Electrical | No exposed HV, no pinch gaps | — |

No measured compliance table is checked in yet — `firmware/measurements.md` is the next PR (Roadmap Phase 2).

## What is NOT claimed

No native USB HID braille display enumeration, no JAWS/NVDA driver, no 40-cell commercial replacement, no raised-dot fidelity guarantee (phone vibration ≠ braille), no safety certification. Cost framing is sub-$30 DIY on-ramp vs $3k–$15k commercial, not parity.

## BOM hints (from firmware READMEs, not invented)

Single-cell: Arduino (Uno/Nano), 6 solenoids or piezo actuators, driver transistors, flyback diodes. Strip: shift registers 74HC595 per cell, common driver. See `firmware/*/README.md` for the per-target BOM and wiring — do not add parts here.

## Next step for contributors

1. `cd pwa && npm ci && npm run dev` → `/hardware-emulator` — paste compact protocol, verify line-number errors.
2. `python tools/tactile_serve.py --file frames.txt --out stdout` — no deps.
3. Only then `serial:COM5` (pyserial) or `brltty` (python3-brlapi + running `brltty`).
