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

## Frame hold is non-blocking

`handleFrame` does not call `delay()`. After setting the dot pins and printing `OK F <index>`, it records an end-of-hold timestamp and returns. The main loop keeps draining the serial port and queuing incoming lines while the frame is on. When the hold expires, pins are blanked (if `blank=1`) and the next queued line runs.

This means the host can stream the entire compact batch in one write without overflowing the AVR's 64-byte serial RX buffer. A small line queue (12 slots) absorbs any backlog that builds up during the hold. If the queue ever fills, the firmware prints `ERR queue full, dropping lines`.

