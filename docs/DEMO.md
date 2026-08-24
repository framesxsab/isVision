# Demo — isVisible (deterministic, no hardware)

**Path:** Reader → a11y → tactile → virtual → diagnostics → research → export

1. **Reader** `/reader` — paste `https://example.com` → Load → Play (Space), check sentence nav Alt+←/→, TOC filter, reading time `≈ N min`
2. **Accessibility** — check `aria-busy` on Vision analyzing, skip link Tab, headingValidator (one h1), reduced-motion via `prefers-reduced-motion`
3. **Tactile** `/tactile-output` — paste "Hello" → preview zoom 1x/1.5x/2x → Export History Replay
4. **Virtual** `/hardware-emulator` — paste compact `F 0 0 1` → play, no hardware
5. **Diagnostics** `/device-diagnostics` — list Mock/Virtual/hid-braille, toggle Enable, Connect Mock, Hot-swap to Virtual (no reload), Install JSON
6. **Research** `/research-playground` — enter P01, check consent, Randomize order, Start task A, Stop, Export CSV, Record session (isvisible-repro-*), SUS Q1-10
7. **Export** — CSV `task_timing.schema.csv` + `anonymize_field_notes.py` before commit

All software/emulated, no HID device needed. Run `npm run verify` before demo.
