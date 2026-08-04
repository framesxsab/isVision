# Cell-Strip Tactile Firmware

Phase 3 hardware target: a strip of **N** six-dot braille cells (default 4, configurable 1–8) driven by daisy-chained 74HC595 shift registers, with physical navigation buttons and a braille keyboard that report back over the same serial wire.

## Hardware Assumption

Each cell is one 74HC595 register holding its dot pattern as one byte (dot 1 = bit 0 … dot 8 = bit 7). Registers are daisy-chained `Q7'` → next `SER`:

```text
DATA_PIN  (2)  -> 74HC595 #0 SER  (pin 14)
CLOCK_PIN (3)  -> 74HC595 #0 SRCLK (pin 11)
LATCH_PIN (4)  -> 74HC595 #0 RCLK  (pin 12)
#0 Q7'         -> #1 SER, #1 Q7' -> #2 SER, ...
```

Inputs (all active-low with internal pull-ups):

```text
prev    -> pin 5      next  -> pin 6       select -> pin 7
dot 1-8 -> pins 8,9,10,11,12,13,A0,A1      space  -> pin A2
```

Do not drive solenoids/motors directly from register outputs — use a driver (ULN2803, MOSFETs) with flyback protection.

To change the strip length, edit `CELL_COUNT` at the top of the sketch (1–8).

## Protocol

Speaks the same compact protocol as the single-cell sketch (see [docs/tactile-protocol.md](../../docs/tactile-protocol.md)) — an `F` line with **multiple masks** maps one mask per cell, starting at `cellStart`:

```text
F 0 0 1 3 9 25   # four cells in one frame
```

Plus a strip extension: `CFG` accepts `input_mode=0|1`, and the firmware emits `IN` lines:

```text
IN key=next|prev|select|enter
IN braille=<mask>
```

- Nav buttons always emit `IN key=…` on press.
- In `input_mode=1`, the eight dot keys report the current 8-dot mask as `IN braille=<mask>` on any change, and the space bar commits with `IN key=enter`.
- The sketch reports its size on startup: `isVisible cell-strip firmware ready (4 cells)`.

Malformed lines are rejected, not coerced; queue/line overflow blanks all cells and aborts the batch until `END`.

## From the PWA

1. Open `/tactile-output`.
2. Select `Compact`.
3. Connect the board over Web Serial.
4. Press `Send`.

To drive a specific strip size from the Python CLI, use `--group-size`:

```text
echo "Hello" | python tools/braille_stream.py --group-size 4
```
