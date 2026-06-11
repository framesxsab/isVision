# Tactile Protocol

The project uses two frame formats:

- JSON Lines for debugging, logs, and desktop tooling.
- Compact text for microcontrollers.

The PWA Tactile Output Lab can produce both formats. Web Serial sends the compact format because it is easier to parse on Arduino-class boards.

## Compact v1

Each command is one newline-terminated ASCII line.

```text
# isVisible tactile compact protocol v1
CFG hold_ms=900 blank=1
F 0 0 32
B
F 1 1 19
B
END
```

Commands:

- `CFG hold_ms=<number> blank=<0|1>` sets firmware playback behavior. The Arduino prototype accepts `hold_ms` from `100` through `5000`.
- `F <frame_index> <cell_start> <mask...>` renders one frame. Each mask is an eight-dot braille bitmask in the range `0..255`. Six-dot prototypes drive dots 1-6 and ignore dots 7-8.
- `B` blanks all pins.
- `END` marks the end of a batch and blanks pins.
- Lines beginning with `#` are comments.

Firmware and bridge implementations should reject malformed numeric fields instead of coercing them. A bad frame must not actuate a different dot pattern than the host intended.

The first single-cell Arduino firmware has a small serial command queue. Hosts should pace compact playback by waiting at least `hold_ms` after each `F` line. If the firmware reports queue overflow, treat the batch as failed and resend from the beginning after `END`.

## Dot Mask

Braille masks use bits 0 through 7:

```text
dot 1 = 1
dot 2 = 2
dot 3 = 4
dot 4 = 8
dot 5 = 16
dot 6 = 32
dot 7 = 64
dot 8 = 128
```

Examples:

- `1` means dot 1.
- `3` means dots 1 and 2.
- `32` means dot 6.
- `60` means dots 3, 4, 5, and 6.
- `255` means all eight dots.

## JSON Lines

JSON Lines preserve the full frame object:

```json
{"type":"frame","mode":"text","index":0,"cellStart":0,"cells":[{"mask":1,"source":"a","role":"content","dots":[1],"unicode":"⠁"}]}
```

Use JSON Lines for tests and tooling. Use compact v1 for first hardware.
