# Hardware Honesty — What isVisible Can and Cannot Do Today

isVisible is a prototype. This page states plainly what works today, what is still missing, and what this project does not claim to be. If you are evaluating it against a commercial braille display, read this first.

## What the PWA does

The Tactile Output Lab turns text into braille frames entirely in your browser. Liblouis handles translation (Grade 1 debug plus Grade 2 tables for English UEB, French, and German). Frames go out over Web Serial or WebHID, or export as JSON Lines and the compact v1 text protocol for downstream tooling. Nothing here produces raised dots by itself. On a phone, "haptic feedback" means vibration, not braille.

## What tactile_serve.py does

The Python bridge reads the compact protocol and dispatches each frame to one of three sinks:

- `stdout` pretty-prints events for debugging, with no extra dependencies.
- `serial:<port>` relays the stream byte-for-byte to a serial device via pyserial, so firmware on the other end sees exactly what the PWA sent.
- `brltty` sends each frame's dot masks through BrlAPI `writeDots` to a running BRLTTY daemon, using the optional `python3-brlapi` bindings.

That third sink deserves precision: **this is a relay, not a driver.** isVisible connects to BRLTTY, which already owns the display. It does not enumerate USB HID braille devices, does not speak any vendor's USB protocol, and cannot replace BRLTTY. If BRLTTY is not running, the sink does nothing.

## What the firmware does

Two Arduino sketches accept the compact protocol. The single-cell target drives one six-dot cell on GPIO pins 2–7. The cell-strip target drives 4–8 cells through daisy-chained 74HC595 shift registers, with navigation buttons and a braille keyboard reporting back as `IN` lines. Both are working sketches, not validated products. Neither has been tested against mass-produced actuator hardware, and both require you to add real drivers (ULN2803 or MOSFETs) between the board and any solenoid. You supply the Arduino and the actuator build yourself.

## What isVisible does NOT do yet

- No native USB HID braille display enumeration.
- No JAWS or NVDA driver.
- No 40-cell commercial replacement. The strip tops out at 8 cells.
- No guarantee of raised-dot fidelity. The software emits correct dot masks; whether pins physically rise depends on hardware we do not ship.

## Cost context

A single DIY cell can be built for under $30 in parts. Commercial refreshable displays run roughly $3,000 to $15,000. That gap is the point of the project: isVisible is a literacy on-ramp, a cheap way to learn braille and experiment with tactile output. It is not a replacement for a purpose-built display, and it should not be funded or purchased as one.
