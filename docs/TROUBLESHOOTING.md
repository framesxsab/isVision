# Troubleshooting — isVisible

- **Build fails on stories:** remove `*.stories.tsx` from `pwa/src` (they’re not built, `.storybook` is config only)
- **WebSerial not available:** use `MockDevice` or `VirtualDevice` — diagnostics shows `available: false` + reason
- **BRLTTY relay:** needs running `brltty` + `python3-brlapi` (see `HARDWARE.md`, `docs/hardware-honesty.md`)
- **Camera/mic denied:** `Settings` → `Run setup again` or browser site settings
- **Python tests:** `python -m unittest discover -s tests` — 32 tests, no extra deps
