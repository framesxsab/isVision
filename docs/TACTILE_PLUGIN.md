# Tactile Plugin Interface — isVisible (software side)

> BRLTTY is a **relay**, not a driver — `docs/hardware-honesty.md`, `HARDWARE.md`. This doc defines how to add a *new sink* without breaking the PWA→bridge→firmware contract.

## Contract

- **Source of truth:** `src/isvisible/protocol.py` — `ProtocolStream`, `Frame`, `parse_compact_stream`, `serialize_compact_stream`. PWA emits compact v1 (`CFG`, `F`, `B`, `END`, `IN`) — do not change grammar without bumping protocol version.
- **Sink interface:** `tools/tactile_serve.py:58-72` `Sink` Protocol — `open()`, `on_config(stream)`, `on_frame(frame)`, `on_blank()`, `close()`. `dispatch()` enforces `hold_ms` via injectable `sleep`. Add a new class `MySink` implementing `Sink`, register in `build_sink()` (`--out mysink:arg`).

## Adding a sink

1. Create `tools/my_sink.py` with `@dataclass class MySink: name="mysink"` — import lazily in `tactile_serve.py` so missing deps disable sink with clear error (pattern: `try: import X except ImportError: raise SystemExit("... pip install X")`).
2. Map frame masks `frame.masks: list[int]` (bits 1–8, 0–255) to your device — `frame.cell_start` is column offset, `self._cell_count` is display width (truncate/pad, never overflow).
3. Test: `python tools/braille_stream.py "Hello" --unicode | python tools/tactile_serve.py --out mysink --no-sleep --echo` — `--echo` re-emits parsed stream for diff.

## PWA side

`pwa/src/modules/tactile-output/tactileStore.ts` + `liblouisAdapter.ts` + `brailleFrames.ts` are the PWA source — `inputAdapters.ts` pushes handoff text (`pushTactileHandoff`). Do not add hardware-specific code in PWA; keep PWA emitting frames only.

## Export formats

- `compact` (firmware/bridge) and `jsonl` (debug) — `tactileStore outputFormat`. New formats should be *exporters* from frames, not new protocols.

See `API.md` §Protocol and `ARCHITECTURE.md` §Data flows.
