"""Tests for the tactile-serve dispatcher and CLI.

We exercise the dispatcher with a recording fake sink so we don't need a real
serial port or a running BRLTTY daemon. The CLI is invoked via ``main()``
directly so argparse / file plumbing is also covered.
"""

import io
import sys
import unittest
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT / "tools"))

from isvisible import Frame, ProtocolStream, parse_compact_stream  # noqa: E402

import tactile_serve  # noqa: E402  (tool under test)


WIRE_FIXTURE = "\n".join(
    [
        "# isVisible tactile compact protocol v1",
        "CFG hold_ms=120 blank=1",
        "F 0 0 1",
        "B",
        "F 1 1 3",
        "B",
        "END",
    ]
)


@dataclass
class RecorderSink:
    """Minimal sink that records every interaction in order."""

    name: str = "recorder"
    opened: bool = False
    closed: bool = False
    cfg: ProtocolStream | None = None
    frames: list[Frame] = field(default_factory=list)
    events: list[str] = field(default_factory=list)

    def open(self) -> None:
        self.opened = True
        self.events.append("open")

    def on_config(self, stream: ProtocolStream) -> None:
        self.cfg = stream
        self.events.append(f"cfg:{stream.config.hold_ms}")

    def on_frame(self, frame: Frame) -> None:
        self.frames.append(frame)
        self.events.append(f"frame:{frame.index}")

    def on_blank(self) -> None:
        self.events.append("blank")

    def close(self) -> None:
        self.closed = True
        self.events.append("close")


class DispatcherTests(unittest.TestCase):
    def test_dispatches_events_in_order_and_closes(self):
        stream = parse_compact_stream(WIRE_FIXTURE)
        sink = RecorderSink()
        sleeps: list[float] = []

        tactile_serve.dispatch(stream, sink, sleep=sleeps.append)

        self.assertEqual(
            sink.events,
            [
                "open",
                "cfg:120",
                "frame:0",
                "blank",
                "frame:1",
                "blank",
                "close",
            ],
        )
        # hold_ms=120 → 0.12s sleep after each frame, two frames.
        self.assertEqual(sleeps, [0.12, 0.12])
        self.assertTrue(sink.opened)
        self.assertTrue(sink.closed)

    def test_hold_ms_override_skips_sleep(self):
        stream = parse_compact_stream(WIRE_FIXTURE)
        sink = RecorderSink()
        sleeps: list[float] = []

        tactile_serve.dispatch(stream, sink, sleep=sleeps.append, hold_ms_override=0)

        self.assertEqual(sleeps, [])
        self.assertEqual([f.index for f in sink.frames], [0, 1])

    def test_close_runs_even_when_sink_raises_on_frame(self):
        class Boom(RecorderSink):
            def on_frame(self, frame: Frame) -> None:  # type: ignore[override]
                super().on_frame(frame)
                raise RuntimeError("explode")

        stream = parse_compact_stream(WIRE_FIXTURE)
        sink = Boom()

        with self.assertRaises(RuntimeError):
            tactile_serve.dispatch(stream, sink, sleep=lambda _s: None)

        self.assertTrue(sink.closed, "close() must run even when on_frame raises")


class StdoutSinkTests(unittest.TestCase):
    def test_pretty_prints_each_event(self):
        sink = tactile_serve.StdoutSink()
        stream = parse_compact_stream(WIRE_FIXTURE)
        buf = io.StringIO()
        original = sys.stdout
        sys.stdout = buf
        try:
            sink.open()
            sink.on_config(stream)
            for event in stream.events:
                if isinstance(event, tactile_serve.FrameEvent):
                    sink.on_frame(event.frame)
                else:
                    sink.on_blank()
            sink.close()
        finally:
            sys.stdout = original

        output = buf.getvalue()
        self.assertIn("hold_ms=120 blank=1", output)
        self.assertIn("frame 0 @cell 0:", output)
        self.assertIn("0x01", output)
        self.assertIn("blank", output)


class CliTests(unittest.TestCase):
    def test_build_sink_resolves_known_names(self):
        self.assertIsInstance(tactile_serve.build_sink("stdout"), tactile_serve.StdoutSink)
        self.assertIsInstance(
            tactile_serve.build_sink("serial:COM7"), tactile_serve.SerialSink
        )
        self.assertIsInstance(tactile_serve.build_sink("brltty"), tactile_serve.BrlttySink)

    def test_build_sink_rejects_serial_without_port(self):
        with self.assertRaises(SystemExit):
            tactile_serve.build_sink("serial:")

    def test_build_sink_rejects_unknown(self):
        with self.assertRaises(SystemExit):
            tactile_serve.build_sink("ftdi")

    def test_main_runs_against_stdout_with_a_file(self):
        # Round-trip from disk: write the fixture, invoke main with --file, and
        # confirm the dispatcher produces frame lines on stdout.
        tmp = Path(self.id().replace(".", "_") + ".txt")
        tmp.write_text(WIRE_FIXTURE, encoding="utf-8")
        self.addCleanup(lambda: tmp.unlink(missing_ok=True))

        buf = io.StringIO()
        original = sys.stdout
        sys.stdout = buf
        try:
            exit_code = tactile_serve.main(["--file", str(tmp), "--no-sleep"])
        finally:
            sys.stdout = original

        self.assertEqual(exit_code, 0)
        output = buf.getvalue()
        self.assertIn("frame 0 @cell 0:", output)
        self.assertIn("frame 1 @cell 1:", output)


if __name__ == "__main__":
    unittest.main()
