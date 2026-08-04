# OS Integration

Phase 5 deliverable: make isVisible useful *outside* demos by integrating with the tools blind users already run, instead of replacing them. This doc is the integration matrix and the concrete path for each sink, with pointers into the codebase.

The core principle (from `README.md`): do not replace screen readers; integrate with NVDA, Narrator, TalkBack, VoiceOver, and BRLTTY where possible. The app speaks one compact frame protocol; the bridge and the firmware are the adapters.

## The integration surface

Every output path starts from the same compact protocol (see [docs/tactile-protocol.md](tactile-protocol.md)). The PWA emits it; sinks consume it. Today we have four sinks:

| Destination | Where it ships | Transport | Status |
| --- | --- | --- | --- |
| BRLTTY (any braille display) | `tools/tactile_serve.py --out brltty` | BrlAPI over a local socket | Implemented, optional `python3-brlapi` |
| Real serial microcontroller | `tools/tactile_serve.py --out serial:PORT` | pyserial | Implemented, optional `pyserial` |
| WebHID braille display | PWA **Tactile Lab** → "Send to HID display" | navigator.hid output report | Implemented in `pwa/src/modules/tactile-output/webHidAdapter.ts` |
| Web Serial microcontroller | PWA **Tactile Lab** / **Tactile Graphics** → "Send over serial" | navigator.serial | Implemented |
| stdout (debug / pipe) | `tools/tactile_serve.py --out stdout` | text | Implemented (default) |

## BRLTTY / BrlAPI

`tools/tactile_serve.py` ships a `BrlttySink` that opens a BrlAPI connection, takes exclusive TTY mode, and calls `writeDots` with the frame's cell masks laid into a display-width buffer. This lets any commercially available braille display act as the prototype's actuator surface — no custom hardware required.

```text
sudo apt install python3-brlapi brltty
python tools/tactile_serve.py --out brltty --file frames.txt
```

`on_config` is intentionally a no-op (BRLTTY has no CFG concept); the bridge honors `hold_ms` via its dispatcher sleep. Bind `hold_ms` lower for graphics (50–100 ms) than for reading.

## WebHID braille displays

`pwa/src/modules/tactile-output/webHidAdapter.ts` requests a device in the standard HID Braille Display usage page (0x41, usage 0x01) and sends an output report whose payload is a flat `Uint8Array` of cell masks (one byte per cell, dots 1–8 in low→high bit order — exactly the wire format every other sink uses). There is no real braille display in CI; the unit test exercises the encoder (`cellsToReport`) and dispatcher (`sendBraille` with an injected HID handle); end-to-end verification is manual.

## Web Serial microcontrollers

The PWA's **Tactile Lab** and **Tactile Graphics** send the compact protocol line-by-line over `navigator.serial`, pacing each `F` line by `hold_ms` (plus a small margin) so the firmware's small queue never overflows. Two firmware targets accept it:

- [firmware/single-cell-arduino/](../firmware/single-cell-arduino/) — one six-dot cell.
- [firmware/cell-strip-arduino/](../firmware/cell-strip-arduino/) — a 4–8-cell strip with navigation buttons and a braille keyboard that report back as `IN` lines (see the protocol doc).

## NVDA / Narrator / TalkBack / VoiceOver

These screen readers are the primary speech layer; isVisible deliberately does **not** re-implement speech. Integration with them is via the existing web platform:

- The app is fully keyboard-navigable and uses ARIA live regions (`pwa/src/core/a11y/AriaLive.tsx`) so screen readers announce route changes, voice confirmations, and tactile status without custom drivers.
- The **Touch Explorer** describes the same DOM elements these readers expose, so users can pair live-region announcements with tactile exploration.
- A future NVDA add-on could relaunch isVisible's compact protocol directly to a BRLTTY display (the BrlAPI sink above is the bridge); no app change is needed because the protocol is shared.

## Future integration points

- **USB HID braille host-mode** for the strip firmware (a HID descriptor that lets the strip act as a host braille display, consumed by NVDA's native braille driver) — the `IN` input lines already establish the host→app direction; the descriptor is the remaining work.
- **TalkBack braille** uses the same braille-display HID class, so a HID-descriptor-equipped strip should also pair with a phone on Android.
- **Document format breadth** in the Reader — today it fetches and extracts an article from a URL; `.md`, `.txt`, and clipboard handoff already feed the Tactile Lab; an EPUB path is a natural extension.

## Verification

The integration paths are covered without specialized hardware:

- The compact protocol parser/serializer round-trips in `tests/test_protocol.py` (Python) and `pwa/src/modules/tactile-output/brailleFrames.test.ts` (TS).
- The BRLTTY and serial sinks' dispatcher logic is tested against an injectable sleep in `tests/test_tactile_serve.py`.
- The WebHID encoder is unit-tested in `pwa/src/modules/tactile-output/webHidAdapter.test.ts` with an injected device handle.

End-to-end runs against real BRLTTY/a real display remain manual, documented above.