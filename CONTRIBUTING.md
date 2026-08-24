# Contributing to isVisible

Thanks for your interest in improving isVisible. This project builds tactile and non-visual computer access tools for blind and low-vision users, so accessibility is part of every pull request, not an afterthought.

## Prerequisites

- Node.js >= 20 (the PWA enforces this through `engines` in `pwa/package.json`)
- Python 3.12 (for the OS bridge tools and their test suite)
- Git
- Optional: Arduino CLI, if you want to compile the firmware targets under `firmware/`

## Quick start

```bash
cd pwa
npm ci
npm run dev
```

Open http://localhost:5173 on your desktop or phone. The dev script (`scripts/start-dev.mjs`) copies Liblouis WASM assets first via its `predev` hook.

To run the server-side proxy that keeps provider keys out of the browser:

```bash
cd pwa
$env:NVIDIA_VISION_API_KEY="your-server-side-key"
npm run server
```

## Build & Verify

Run these before opening a pull request. CI runs the same commands.

```bash
cd pwa
npm run build      # tsc -b, then node scripts/vite-build.mjs (prebuild also runs the env-leak guard)
npm test           # Vitest unit tests (vitest run)
npm run test:a11y  # Playwright + axe-core across every route
```

Python bridge and protocol tests from the repo root:

```bash
python -m unittest discover -s tests
```

Notes:

- `npm run build` triggers `prebuild`, which runs `npm run check-env` (the VITE_* secret-leak guard) and copies Liblouis assets. If the build fails on the env guard, see SECURITY.md.
- The a11y suite needs Playwright Chromium: `npx playwright install --with-deps chromium`.
- Shortcut: `npm run verify` chains build, unit tests, and the a11y suite in one command.

## Project structure

| Path | What lives there |
| --- | --- |
| `pwa/src` | React + TypeScript PWA source: modules, stores, components |
| `tools/` | Python OS bridge (`tactile_serve.py`) and CLI utilities such as `braille_stream.py` |
| `firmware/` | Arduino targets: single-cell and cell-strip braille displays |
| `docs/` | Research notes, roadmap, architecture docs, setup guides |

## Branches and pull requests

1. Fork the repository, or work from a feature branch if you have write access.
2. Name branches descriptively, e.g. `feat/drill-csv-export` or `fix/reader-focus-restore`.
3. Keep changes focused: one logical change per pull request makes review faster.
4. Commit messages follow conventional-commit style hints, e.g. `feat: add drill CSV export`, `fix(reader): restore focus after navigation`.
5. Push and open a PR against `main`, filling in the pull request template.
6. All three CI jobs must pass before merge: `pwa` (typecheck, tests, build with the env-leak guard), `a11y` (axe-core regression), and `bridge` (Python tests). A maintainer review is required.

## Code style

- TypeScript strict mode stays on. Do not use `as any`; find the real type instead.
- Format with the tooling already configured in the repo rather than reformatting unrelated files.
- Prefer small, pure functions covered by Vitest tests.
- Python code stays dependency-light; heavy imports like pyserial and brlapi are lazy by convention.

## Accessibility guidelines

This project serves blind and low-vision users, so every UI change must hold these lines:

- All new controls are keyboard reachable, with a sensible focus order and a visible focus state.
- Dynamic updates (status messages, results, errors) announce through `aria-live` regions instead of relying on color or motion alone.
- Test with a screen reader (NVDA, Narrator, VoiceOver, or TalkBack) before requesting review.
- The axe-core suite in `npm run test:a11y` must stay green, and new routes need coverage.

## Reporting bugs and security issues

Bugs: open a GitHub issue with the bug report template. Security: do not open a public issue. Follow SECURITY.md and email security@isvisible.example.

## Licensing

By contributing, you agree that your contributions are licensed under the MIT License that covers this repository.
