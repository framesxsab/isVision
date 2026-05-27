"""Core helpers for the isVisible tactile access prototype."""

from .braille import BrailleCell, translate_grade1_debug
from .frames import build_frames
from .protocol import (
    BlankEvent,
    Config,
    Frame,
    FrameEvent,
    ProtocolError,
    ProtocolStream,
    parse_compact_stream,
    serialize_compact_stream,
)

__all__ = [
    "BlankEvent",
    "BrailleCell",
    "Config",
    "Frame",
    "FrameEvent",
    "ProtocolError",
    "ProtocolStream",
    "build_frames",
    "parse_compact_stream",
    "serialize_compact_stream",
    "translate_grade1_debug",
]

