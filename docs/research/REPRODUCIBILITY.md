# Reproducibility — isVisible

## PWA

```bash
cd pwa && npm ci && npm run verify   # build + 212 vitest + 83 e2e (axe 13/13)
python -m unittest discover -s tests   # 32 bridge
```

CI reproduces this in `.github/workflows/ci.yml` (pwa → a11y, bridge).

## Frames

```bash
python tools/braille_stream.py "Hello 123" --unicode --group-size 1 | python tools/tactile_serve.py --out stdout --no-sleep
```

Protocol: `src/isvisible/protocol.py` + `docs/tactile-protocol.md` (CFG/F/B/END).

## Field study

1. Copy templates: `docs/research/templates/{interview,consent,sus}.template.md` + `task_timing.schema.csv`
2. Run 60m sessions per `FIELD_STUDY_PROTOCOL.md`, record timing CSV locally (IDs P01…).
3. Anonymize before commit: `python tools/anonymize_field_notes.py docs/research/field-notes.md > docs/research/field-notes.anonymized.md`
4. Commit only anonymized `field-notes.md` (no PII, no audio/video).

See `RESEARCH.md` for artifact index and `FIELD_STUDY_PROTOCOL.md` for N=12 plan — do not invent participants.
