# Architectural Report — v0.2.0-prep (cbc8804..f87fda8)

## Diff summary (v0.1.0 e786794 → v0.2.0-prep HEAD)

14 → 28 files changed across 4 commits to HEAD (before this report):
- Phase 1 docs: 14 files +560 (handoff)
- Phase 2 a11y polish: 3 files +16 (focus return, switch, content hardening)
- Phase 3 leaderboard: 4 files +97 (hooks/helpers)
- Phase 4 research infra: 6 files +149
- Phase 5 DX: 4 files +44
- Phase 6 tactile plugin: 2 files +38
- Phase 7 community: 42 files +388

Total additive: ~1290 lines, zero deletions of features. Branch: `v0.2.0-prep`.

## System (from ARCHITECTURE.md)

PWA shell `pwa/src/App.tsx:22-29` 8 lazy routes behind RequireOnboarding; state `isvisible-settings`/`isvisible-tactile`/`isvisible.reader.pos:`; Workbox precache 30 entries; `wrangler.jsonc` Cloudflare. Data flows: URL→speech (DOMPurify→chunks), text→braille (liblouis WASM), camera→server proxy (NVIDIA key never bundled), voice→event, frames→compact v1→`tactile_serve` sinks.

## Why unchanged

Architecture preserved per non-negotiable rules — no route/API/folder rewrites, history intact (`e786794` tag untouched). Only additive docs/utils and P0/P1 a11y fixes objectively better (2.4.3 focus return, 4.1.2 switch, 4.1.1 sanitization).

## Remaining gaps

- Heading validator not yet gated in `a11y.spec.ts` (issue 02)
- Coverage/reporting not yet in CI (issue 18)
- Liblouis es/pt tables, HID spike pending (Phase 6/7)
