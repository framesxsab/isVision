#!/usr/bin/env python
"""Bridge the PWA's compact tactile protocol to an OS-level output sink.

The PWA emits the compact text protocol (see
``src/isvisible/protocol.py`` for the grammar) over Web Serial or by file
export. This script reads that stream and dispatches frames to one of:

* ``stdout`` — pretty-prints each event (default, no extra deps)
* ``serial:<port>`` — writes the same compact stream to a serial device via
  :mod:`pyserial`; useful for testing firmware on a real microcontroller
* ``brltty`` — writes each frame's dot masks to a running BRLTTY daemon via
  the BrlAPI Python bindings; lets any BRLTTY-connected braille display act
  as the prototype's actuator surface

The script is intentionally stdlib-only; ``pyserial`` and ``brlapi`` are
imported lazily so missing them just disables those sinks with a clear error
message rather than blowing up at import time.

Usage::

    python tools/tactile_serve.py --out stdout < frames.txt
    python tools/tactile_serve.py --out serial:COM5 --file frames.txt
    python tools/tactile_serve.py --out brltty --file frames.txt --no-sleep

Pass ``--no-sleep`` to skip the inter-frame ``hold_ms`` delay (handy for
piping into another script that wants the events as fast as possible).
"""

from __future__ import annotations

import argparse
import sys
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from isvisible.protocol import (  # noqa: E402
    BlankEvent,
    Frame,
    FrameEvent,
    ProtocolError,
    ProtocolStream,
    parse_compact_stream,
    serialize_compact_stream,
)


# ---------------------------------------------------------------------------
# Sink interface
# ---------------------------------------------------------------------------


class Sink(Protocol):
    """A consumer of parsed protocol events.

    Implementations should be safe to call from a single thread and should
    raise on permanent failure. ``open`` / ``close`` are called once each;
    ``on_frame`` and ``on_blank`` are called per event in stream order.
    """

    name: str

    def open(self) -> None: ...
    def on_config(self, stream: ProtocolStream) -> None: ...
    def on_frame(self, frame: Frame) -> None: ...
    def on_blank(self) -> None: ...
    def close(self) -> None: ...


@dataclass
class StdoutSink:
    """Default sink: pretty-prints events for debugging."""

    name: str = "stdout"

    def open(self) -> None:
        return None

    def on_config(self, stream: ProtocolStream) -> None:
        cfg = stream.config
        print(f"# hold_ms={cfg.hold_ms} blank={int(cfg.blank_between_frames)}")

    def on_frame(self, frame: Frame) -> None:
        unicode_preview = "".join(chr(0x2800 + (m & 0x3F)) for m in frame.masks)
        masks = " ".join(f"0x{m:02x}" for m in frame.masks)
        print(f"frame {frame.index} @cell {frame.cell_start}: {unicode_preview}  [{masks}]")

    def on_blank(self) -> None:
        print("blank")

    def close(self) -> None:
        return None


@dataclass
class SerialSink:
    """Forwards the original compact stream to a serial device.

    ``pyserial`` is imported lazily so this file remains importable in
    environments that don't have it installed. The relay is byte-for-byte —
    firmware running on the other end sees exactly what the PWA would send.
    """

    port: str
    baud: int = 115200
    name: str = "serial"

    def __post_init__(self) -> None:
        self._serial = None
        self._buffer: list[str] = []
        self._cfg_line: str | None = None

    def open(self) -> None:
        try:
            import serial  # type: ignore[import-not-found]
        except ImportError as exc:  # pragma: no cover - depends on environment
            raise SystemExit(
                "The 'serial' sink needs pyserial. Install it with: pip install pyserial"
            ) from exc
        self._serial = serial.Serial(self.port, self.baud, timeout=1)

    def on_config(self, stream: ProtocolStream) -> None:
        cfg = stream.config
        self._cfg_line = (
            f"CFG hold_ms={cfg.hold_ms} blank={1 if cfg.blank_between_frames else 0}"
        )
        self._write_line("# isVisible tactile compact protocol v1")
        self._write_line(self._cfg_line)

    def on_frame(self, frame: Frame) -> None:
        mask_str = " ".join(str(m) for m in frame.masks)
        line = f"F {frame.index} {frame.cell_start}"
        if mask_str:
            line = f"{line} {mask_str}"
        self._write_line(line)

    def on_blank(self) -> None:
        self._write_line("B")

    def close(self) -> None:
        if self._serial is not None:
            try:
                self._write_line("END")
            finally:
                self._serial.close()
                self._serial = None

    def _write_line(self, line: str) -> None:
        if self._serial is None:
            raise RuntimeError("Serial sink used before open()")
        self._serial.write((line + "\n").encode("utf-8"))


@dataclass
class BrlttySink:
    """Forwards each frame's dot masks to a running BRLTTY daemon.

    BRLTTY exposes BrlAPI on a local socket; the Python bindings (``brlapi``)
    are an optional system package, typically installed as ``python3-brlapi``
    on Linux distributions. When the binding is missing we surface a clear
    error instead of trying to roll our own BrlAPI socket protocol.

    The daemon expects dot patterns as a sequence of 8-dot bytes via
    ``writeDots``. Our masks are 6-dot in the lower bits, which the daemon
    interprets correctly for 6-dot displays; for 8-dot displays dots 7 and 8
    will simply stay down because we don't set those bits.
    """

    name: str = "brltty"

    def __post_init__(self) -> None:
        self._connection = None
        self._cell_count = 0

    def open(self) -> None:
        try:
            import brlapi  # type: ignore[import-not-found]
        except ImportError as exc:  # pragma: no cover - depends on environment
            raise SystemExit(
                "The 'brltty' sink needs the python brlapi bindings. "
                "On Debian/Ubuntu: sudo apt install python3-brlapi"
            ) from exc
        self._connection = brlapi.Connection()
        # Take exclusive control of the display so other clients don't fight
        # us over the writeDots calls.
        try:
            self._connection.enterTtyMode()
        except Exception:  # pragma: no cover - real daemon required
            self._connection.leaveTtyMode()
            raise
        size = self._connection.displaySize
        self._cell_count = int(size[0]) if size else 40

    def on_config(self, stream: ProtocolStream) -> None:
        # BRLTTY has no notion of our CFG line — there's nothing useful to do
        # here. Hold time is enforced by the dispatcher's sleep.
        return None

    def on_frame(self, frame: Frame) -> None:
        if self._connection is None:
            raise RuntimeError("BRLTTY sink used before open()")
        # Lay our masks into a buffer the width of the BRLTTY display. Cells
        # we don't have data for stay neutral (mask 0).
        cells = bytearray(self._cell_count)
        for offset, mask in enumerate(frame.masks):
            index = frame.cell_start + offset
            if 0 <= index < self._cell_count:
                cells[index] = mask & 0xFF
        self._connection.writeDots(bytes(cells))

    def on_blank(self) -> None:
        if self._connection is None:
            raise RuntimeError("BRLTTY sink used before open()")
        self._connection.writeDots(bytes(self._cell_count))

    def close(self) -> None:
        if self._connection is not None:
            try:
                self._connection.leaveTtyMode()
            finally:
                self._connection = None


# ---------------------------------------------------------------------------
# Dispatcher
# ---------------------------------------------------------------------------


def dispatch(
    stream: ProtocolStream,
    sink: Sink,
    *,
    sleep: Callable[[float], None] = time.sleep,
    hold_ms_override: int | None = None,
) -> None:
    """Drive a parsed stream through a sink.

    ``sleep`` is injectable so tests can assert the dispatcher honors the
    configured hold time without actually pausing. ``hold_ms_override`` lets
    the caller force a shorter (or zero) hold when piping events into another
    program that processes them asynchronously.
    """

    sink.open()
    try:
        sink.on_config(stream)
        hold_ms = hold_ms_override if hold_ms_override is not None else stream.config.hold_ms
        for event in stream.events:
            if isinstance(event, FrameEvent):
                sink.on_frame(event.frame)
                if hold_ms > 0:
                    sleep(hold_ms / 1000.0)
            else:
                # BlankEvent
                sink.on_blank()
    finally:
        sink.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def build_sink(spec: str) -> Sink:
    if spec == "stdout":
        return StdoutSink()
    if spec == "brltty":
        return BrlttySink()
    if spec.startswith("serial:"):
        port = spec[len("serial:") :]
        if not port:
            raise SystemExit("serial sink needs a port, e.g. --out serial:COM5")
        return SerialSink(port=port)
    raise SystemExit(
        f"Unknown sink {spec!r}. Use one of: stdout, serial:<port>, brltty"
    )


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Bridge the isVisible compact tactile protocol to an OS-level sink.",
    )
    parser.add_argument(
        "--file",
        type=Path,
        help="Read protocol from a file (default: stdin).",
    )
    parser.add_argument(
        "--out",
        default="stdout",
        help="Sink: stdout (default), serial:<port>, or brltty.",
    )
    parser.add_argument(
        "--no-sleep",
        action="store_true",
        help="Skip the configured hold_ms delay between frames.",
    )
    parser.add_argument(
        "--hold-ms",
        type=int,
        default=None,
        help="Override CFG hold_ms for this run (still honored unless --no-sleep).",
    )
    parser.add_argument(
        "--echo",
        action="store_true",
        help="Re-emit the parsed stream as compact protocol to stdout before dispatching.",
    )
    return parser.parse_args(argv)


def read_stream(args: argparse.Namespace) -> ProtocolStream:
    if args.file:
        text = args.file.read_text(encoding="utf-8")
    else:
        text = sys.stdin.read()
    try:
        return parse_compact_stream(text)
    except ProtocolError as exc:
        raise SystemExit(f"protocol error: {exc}") from exc


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    stream = read_stream(args)

    if args.echo:
        sys.stdout.write(serialize_compact_stream(stream) + "\n")

    sink = build_sink(args.out)

    hold_override: int | None = None
    if args.no_sleep:
        hold_override = 0
    elif args.hold_ms is not None:
        hold_override = max(0, args.hold_ms)

    dispatch(stream, sink, hold_ms_override=hold_override)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
