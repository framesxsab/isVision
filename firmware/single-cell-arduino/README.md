# Single-Cell Tactile Firmware

This is the first hardware target for isVisible: one six-dot tactile braille cell driven by a microcontroller over USB serial.

## Hardware Assumption

The sketch maps six output pins to six braille dots:

```text
dot 1 -> pin 2
dot 2 -> pin 3
dot 3 -> pin 4
dot 4 -> pin 5
dot 5 -> pin 6
dot 6 -> pin 7
```

Do not drive solenoids, motors, or high-current actuators directly from GPIO. Use a driver circuit such as MOSFETs or a motor/solenoid driver board, with flyback protection where needed.

## Protocol

The sketch reads the compact protocol documented in [docs/tactile-protocol.md](../../docs/tactile-protocol.md).

From the PWA:

1. Open `/tactile-output`.
2. Select `Compact`.
3. Connect the board over Web Serial.
4. Press `Send`.

The firmware uses the first mask in each frame for a one-cell prototype. Multi-cell hardware can extend the same `F` line by reading additional masks.

Malformed protocol lines are rejected instead of coerced. `hold_ms` must be an integer from `100` to `5000`, `blank` must be `0` or `1`, frame indices and `cellStart` must be non-negative integers, and every mask on an `F` line must be in the six-dot range `0..63`. Rejected frames leave the current pins unchanged; queue overflow and line overflow blank the pins and abort the current batch.

## Frame hold is non-blocking

`handleFrame` does not call `delay()`. After setting the dot pins and printing `OK F <index>`, it records an end-of-hold timestamp and returns. The main loop keeps draining the serial port and queuing incoming lines while the frame is on. When the hold expires, pins are blanked (if `blank=1`) and the next queued line runs.

The loop keeps draining the serial port during a hold, but this first prototype still has a small 12-line command queue. Hosts should pace playback: send `CFG`, then each `F` line, wait at least `hold_ms`, send the optional `B`, and continue. The PWA Web Serial sender does this pacing automatically.

If a host sends too far ahead and the queue fills, the firmware prints `ERR queue full, batch aborted`, blanks the pins, clears the queue, and ignores incoming lines until `END` resynchronizes the stream. This is intentional: a truncated tactile sequence is worse than a clearly failed one.
