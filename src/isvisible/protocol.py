"""Parser for the compact tactile frame protocol.

The PWA's ``serializeCompactFrames`` (in
``pwa/src/modules/tactile-output/brailleFrames.ts``) emits a small line-based
text format that a microcontroller, a serial bridge, or a BRLTTY adapter can
read without pulling in a JSON parser. This module is the Python inverse: it
parses that format back into structured objects so an OS-side helper
(:mod:`tools.tactile_serve`) can dispatch frames to real hardware.

The wire format::

    # isVisible tactile compact protocol v1
    CFG hold_ms=900 blank=1
    F 0 0 1
    B
    F 1 1 3
    B
    END

Comment lines starting with ``#`` are ignored. ``CFG`` must precede the first
``F``. ``B`` is a "blank between frames" pulse. ``END`` terminates the stream.
"""

from __future__ import annotations

from dataclasses import dataclass, field


PROTOCOL_HEADER = "# isVisible tactile compact protocol v1"
DEFAULT_HOLD_MS = 900
DEFAULT_BLANK = True
MAX_CELL_MASK = 0xFF


class ProtocolError(ValueError):
    """Raised when the compact protocol stream is malformed."""


@dataclass(frozen=True)
class Frame:
    """One tactile frame: index, starting cell offset, and cell masks."""

    index: int
    cell_start: int
    masks: tuple[int, ...]


@dataclass(frozen=True)
class Config:
    """Stream-level configuration emitted via the ``CFG`` line."""

    hold_ms: int = DEFAULT_HOLD_MS
    blank_between_frames: bool = DEFAULT_BLANK


@dataclass
class ProtocolStream:
    """A parsed compact protocol stream.

    ``events`` preserves the original interleave of frames and blank pulses so a
    dispatcher can replay them in order; ``frames`` is the same data filtered
    to just the frame entries for callers that don't care about blanks.
    """

    config: Config
    events: list["StreamEvent"] = field(default_factory=list)

    @property
    def frames(self) -> list[Frame]:
        return [event.frame for event in self.events if isinstance(event, FrameEvent)]


@dataclass(frozen=True)
class FrameEvent:
    """A frame event in the parsed event stream."""

    frame: Frame


@dataclass(frozen=True)
class BlankEvent:
    """A ``B`` line — pin actuators should drop to neutral momentarily."""


StreamEvent = FrameEvent | BlankEvent


def _parse_cfg(line: str) -> Config:
    # Expected: "CFG hold_ms=900 blank=1"
    parts = line.split()
    if not parts or parts[0] != "CFG":
        raise ProtocolError(f"Expected a CFG line, got: {line!r}")
    hold_ms = DEFAULT_HOLD_MS
    blank = DEFAULT_BLANK
    for token in parts[1:]:
        if "=" not in token:
            raise ProtocolError(f"Bad CFG token: {token!r}")
        key, _, raw_value = token.partition("=")
        if key == "hold_ms":
            try:
                hold_ms = int(raw_value)
            except ValueError as exc:
                raise ProtocolError(f"hold_ms must be an integer, got {raw_value!r}") from exc
            if hold_ms < 0:
                raise ProtocolError("hold_ms must be non-negative")
        elif key == "blank":
            if raw_value not in {"0", "1"}:
                raise ProtocolError(f"blank must be 0 or 1, got {raw_value!r}")
            blank = raw_value == "1"
        else:
            # Unknown CFG keys are tolerated for forward-compatibility — a
            # newer firmware/PWA pair might emit extra tokens.
            continue
    return Config(hold_ms=hold_ms, blank_between_frames=blank)


def _parse_frame(line: str) -> Frame:
    # Expected: "F <index> <cellStart> [mask1 mask2 ...]"
    parts = line.split()
    if len(parts) < 3 or parts[0] != "F":
        raise ProtocolError(f"Bad F line: {line!r}")
    try:
        index = int(parts[1])
        cell_start = int(parts[2])
        masks = tuple(int(token) for token in parts[3:])
    except ValueError as exc:
        raise ProtocolError(f"F line had non-integer field: {line!r}") from exc
    if index < 0 or cell_start < 0:
        raise ProtocolError("Frame index and cellStart must be non-negative")
    for mask in masks:
        if mask < 0 or mask > MAX_CELL_MASK:
            raise ProtocolError(f"Cell mask out of range (0..255): {mask}")
    return Frame(index=index, cell_start=cell_start, masks=masks)


def parse_compact_stream(text: str) -> ProtocolStream:
    """Parse a compact protocol stream into a :class:`ProtocolStream`.

    ``text`` is treated as the whole stream — a typical caller will read a file
    or stdin first and hand the contents here. Trailing newlines, blank lines,
    and ``#`` comments are tolerated. ``CFG`` may be implicit (using defaults)
    if it's missing, since older firmware probes may not emit one.
    """

    config: Config | None = None
    events: list[StreamEvent] = []
    saw_end = False

    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if saw_end:
            raise ProtocolError(f"Content after END line: {line!r}")

        head = line.split(maxsplit=1)[0]
        if head == "CFG":
            if config is not None:
                raise ProtocolError("Duplicate CFG line")
            if events:
                # CFG carries hold_ms and blank flags that affect playback of
                # subsequent frames. Letting it land after a frame would mean
                # the frame was played with stale config and then config
                # retroactively changed, which is undefined behavior.
                raise ProtocolError("CFG must precede the first frame")
            config = _parse_cfg(line)
            continue
        if head == "F":
            events.append(FrameEvent(_parse_frame(line)))
            continue
        if head == "B":
            if line != "B":
                raise ProtocolError(f"B line takes no arguments: {line!r}")
            events.append(BlankEvent())
            continue
        if head == "END":
            if line != "END":
                raise ProtocolError(f"END line takes no arguments: {line!r}")
            saw_end = True
            continue
        raise ProtocolError(f"Unknown protocol line: {line!r}")

    return ProtocolStream(config=config or Config(), events=events)


def serialize_compact_stream(stream: ProtocolStream) -> str:
    """Round-trip serializer — mirrors the TS emitter.

    Useful for tests and for relaying a parsed stream to a downstream sink that
    expects the same wire format (e.g. echo mode).
    """

    lines = [
        PROTOCOL_HEADER,
        f"CFG hold_ms={stream.config.hold_ms} blank={1 if stream.config.blank_between_frames else 0}",
    ]
    for event in stream.events:
        if isinstance(event, FrameEvent):
            mask_str = " ".join(str(m) for m in event.frame.masks)
            line = f"F {event.frame.index} {event.frame.cell_start}"
            if mask_str:
                line = f"{line} {mask_str}"
            lines.append(line)
        else:
            lines.append("B")
    lines.append("END")
    return "\n".join(lines)
