"""Tests for the compact protocol parser.

The wire format is shared with the TS emitter in
``pwa/src/modules/tactile-output/brailleFrames.ts``. The fixtures here are
deliberately matched against what that emitter would produce so the two
sides stay in sync.
"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from isvisible import (  # noqa: E402
    BlankEvent,
    FrameEvent,
    ProtocolError,
    StripInputEvent,
    parse_compact_stream,
    serialize_compact_stream,
)


WIRE_FIXTURE = "\n".join(
    [
        "# isVisible tactile compact protocol v1",
        "CFG hold_ms=500 blank=1",
        "F 0 0 1",
        "B",
        "F 1 1 3",
        "B",
        "F 2 2 9",
        "B",
        "END",
    ]
)


class CompactProtocolParserTests(unittest.TestCase):
    def test_parses_the_pwa_emitter_fixture(self):
        stream = parse_compact_stream(WIRE_FIXTURE)

        self.assertEqual(stream.config.hold_ms, 500)
        self.assertTrue(stream.config.blank_between_frames)
        self.assertEqual(len(stream.frames), 3)
        self.assertEqual([f.cell_start for f in stream.frames], [0, 1, 2])
        self.assertEqual([f.masks for f in stream.frames], [(1,), (3,), (9,)])

        # Event ordering matters because some sinks need to issue a blank
        # pulse between frames.
        kinds = [type(event).__name__ for event in stream.events]
        self.assertEqual(
            kinds,
            ["FrameEvent", "BlankEvent", "FrameEvent", "BlankEvent", "FrameEvent", "BlankEvent"],
        )

    def test_round_trips_through_serialize(self):
        stream = parse_compact_stream(WIRE_FIXTURE)
        reserialized = serialize_compact_stream(stream)

        # Re-parsing the serialized form must produce the same structure.
        replay = parse_compact_stream(reserialized)
        self.assertEqual(replay.config, stream.config)
        self.assertEqual(replay.frames, stream.frames)

    def test_uses_default_config_when_cfg_missing(self):
        stream = parse_compact_stream("F 0 0 1\nEND")
        self.assertEqual(stream.config.hold_ms, 900)
        self.assertTrue(stream.config.blank_between_frames)
        self.assertEqual(len(stream.frames), 1)

    def test_tolerates_comments_and_blank_lines(self):
        text = "\n".join(
            [
                "",
                "# free-form comment",
                "CFG hold_ms=10 blank=0",
                "",
                "# another comment",
                "F 0 0 7",
                "END",
            ]
        )
        stream = parse_compact_stream(text)
        self.assertFalse(stream.config.blank_between_frames)
        self.assertEqual(stream.frames[0].masks, (7,))

    def test_rejects_duplicate_cfg(self):
        with self.assertRaises(ProtocolError):
            parse_compact_stream("CFG hold_ms=10 blank=1\nCFG hold_ms=20 blank=0\nEND")

    def test_rejects_cfg_after_a_frame(self):
        # CFG carries hold_ms and blank flags that affect playback of
        # subsequent frames. A CFG that arrives mid-stream would mean we
        # already played a frame under stale config — not a state we want
        # to tolerate silently.
        with self.assertRaises(ProtocolError):
            parse_compact_stream("F 0 0 1\nCFG hold_ms=10 blank=0\nEND")

    def test_rejects_unknown_lines(self):
        with self.assertRaises(ProtocolError):
            parse_compact_stream("XYZ\nEND")

    def test_rejects_negative_indices(self):
        with self.assertRaises(ProtocolError):
            parse_compact_stream("F -1 0 1\nEND")

    def test_accepts_eight_dot_masks(self):
        stream = parse_compact_stream("F 0 0 64 255\nEND")
        self.assertEqual(stream.frames[0].masks, (64, 255))

    def test_rejects_mask_outside_eight_dot_range(self):
        with self.assertRaises(ProtocolError):
            parse_compact_stream("F 0 0 256\nEND")

    def test_rejects_non_integer_mask(self):
        with self.assertRaises(ProtocolError):
            parse_compact_stream("F 0 0 cafe\nEND")

    def test_rejects_blank_with_arguments(self):
        with self.assertRaises(ProtocolError):
            parse_compact_stream("F 0 0 1\nB now\nEND")

    def test_rejects_content_after_end(self):
        with self.assertRaises(ProtocolError):
            parse_compact_stream("F 0 0 1\nEND\nF 1 1 2")

    def test_unknown_cfg_token_is_tolerated(self):
        # Forward-compatibility: a newer emitter might add tokens we don't
        # know about. Don't break — just keep the known fields.
        stream = parse_compact_stream("CFG hold_ms=300 blank=0 future=42\nEND")
        self.assertEqual(stream.config.hold_ms, 300)
        self.assertFalse(stream.config.blank_between_frames)

    def test_parses_strip_input_events(self):
        # Phase 3: multi-cell strip firmware reports navigation buttons and a
        # braille keyboard over the same serial line that receives F frames.
        text = "\n".join(
            [
                "CFG hold_ms=300 blank=0",
                "F 0 0 1 2 3 4",
                "IN key=next",
                "IN braille=5",
                "IN key=select",
                "END",
            ]
        )
        stream = parse_compact_stream(text)

        inputs = [e for e in stream.events if isinstance(e, StripInputEvent)]
        self.assertEqual(
            [(e.kind, e.value) for e in inputs],
            [("key", "next"), ("braille", "5"), ("key", "select")],
        )
        # Frames still parse and sit alongside the input events in order.
        kinds = [type(e).__name__ for e in stream.events]
        self.assertEqual(
            kinds,
            ["FrameEvent", "StripInputEvent", "StripInputEvent", "StripInputEvent"],
        )

    def test_strip_input_round_trips_through_serialize(self):
        stream = parse_compact_stream(
            "CFG hold_ms=300 blank=0\nF 0 0 1\nIN braille=3\nIN key=prev\nEND"
        )
        replay = parse_compact_stream(serialize_compact_stream(stream))
        self.assertEqual(replay.events, stream.events)

    def test_rejects_malformed_strip_input_lines(self):
        with self.assertRaises(ProtocolError):
            parse_compact_stream("IN key\nEND")
        with self.assertRaises(ProtocolError):
            parse_compact_stream("IN unknown=1\nEND")
        with self.assertRaises(ProtocolError):
            parse_compact_stream("IN braille=\nEND")


if __name__ == "__main__":
    unittest.main()
