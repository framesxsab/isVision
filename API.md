# API — isVisible

## PWA internal

### Reader fetch

`POST /api/reader/fetch` (via `server/index.mjs` proxy, `useReader.ts:86` `fetchArticleHtml`)
```bash
curl -s http://localhost:5173/api/reader/fetch \
  -H 'content-type: application/json' \
  -d '{"url":"https://example.com/article"}' | jq .html | head
```
Server validates URL, fetches, `cleanContent` (DOMPurify, strip `role`/`aria-*`/`tabindex` per audit P1-2), `splitIntoChunks`, returns `{title, htmlContent, headings, chunks}`. Client resumes via `sessionStorage` key `isvisible.reader.pos:<url>` (`useReader.ts:17-38`) + `lastSession` (`settingsStore`).

### Liblouis

Lazy WASM `liblouis@^0.4.0` via `liblouisAdapter.ts` — tables `en-g2` (UEB), `fr-g2` (BFU), `de-g2` (Kurzschrift), ~1.6 MB off `vite-plugin-pwa` precache. Config in `tactileStore` (`translatorMode: g1|g2`, `language`, `groupSize`, `holdMs:900`, `blankBetweenFrames`).

### Voice actions

`pwa/src/modules/voice-nav/voiceActions.ts` `MODULE_VOICE_ACTION_EVENT` (`CustomEvent<{action: VoiceAction}>`), F6 global hotkey (`useGlobalVoiceHotkey`), `commandRegistry`. Reader consumes `reader_play|pause|next|previous|speed_up|slow_down` (`ReaderPage.tsx:217`).

## Protocol — compact v1

Grammar: `src/isvisible/protocol.py`, `docs/tactile-protocol.md`.

```
CFG hold_ms=900 blank=1
F 0 0 45 3  ...   # frame index cell_start masks (0-255, bits 1-8)
B                     # blank between frames if blank=1
END
IN ...                # braille keyboard input line from strip
```

Serialization helpers: `serialize_compact_stream`, `parse_compact_stream` (line-number errors), `ProtocolStream` (`config` + `events: FrameEvent|BlankEvent`). Masks `& 0xFF` map to Unicode `U+2800 + mask` in `StdoutSink` preview.

## Bridges

```bash
python tools/braille_stream.py "Hello 123" --unicode --group-size 1
python tools/tactile_serve.py --file frames.txt --out stdout              # no deps
python tools/tactile_serve.py --file frames.txt --out serial:COM5         # pyserial lazy
python tools/tactile_serve.py --file frames.txt --out brltty               # python3-brlapi lazy, exclusive enterTtyMode + writeDots(bytes(cells))
python tools/tactile_serve.py --hold-ms 400 --no-sleep --echo --file frames.txt
```

`dispatch(stream, sink, hold_ms_override)` enforces `hold_ms` between frames via injectable `sleep` (tests avoid real delay). See `HARDWARE.md`.

## Settings keys (persisted)

- `isvisible-settings` (`settingsStore.ts`): `speechRate/Pitch/Volume`, `voiceURI`, `highContrast`, `fontSize`, `hapticEnabled`, `spatialAudioEnabled`, `visionRetainHistory`, `setupStatus`.
- `isvisible-tactile` (`tactileStore.ts`): `translatorMode`, `language`, `groupSize`, `outputFormat: compact|jsonl`, `holdMs`, `blankBetweenFrames`, `drillScore`, `drillMode`, `drillHistory[100]`, `lastImportedText`.

## Generated docs

Run `npm run build` then `npx tsc --project pwa/tsconfig.json --noEmit --pretty` for types; `docs/research/oss-release-research.md:12` is the API appendix source of truth.
