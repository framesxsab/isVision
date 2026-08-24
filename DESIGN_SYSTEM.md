# Design System — isVisible (additive)

> Do not redesign — refine. Reuse `Button`, `Card`, `PageShell`, `TabBar`, `FocusTrap`, `AriaLive` before creating a primitive. Preserve Tailwind tokens and UX identity.

## Tokens (`pwa/tailwind.config.ts` + `src/index.css`)

- **Surface:** `surface-0 #07090c` (html bg), `surface-1 #121821`, `surface-2 #0c1117` (`surface-card`/`surface-panel` gradients), `surface-border` — see `index.css:29-34`. Warm accent `primary 400 #fb923c` (focus `outline 3px #fb923c`, `input accent #fb923c`, `selection rgba(251,146,60,0.4)`).
- **Spacing:** Tailwind defaults; nav offsets `pb-nav 6.25rem + safe-area`, `pb-nav-action 9.5rem`, `bottom-above-nav 5.25rem` (`index.css:7-14`).
- **Typography:** `ui-sans-serif, system-ui`, `optimizeLegibility`, `font-feature cv02 cv03 cv04 cv11 ss01`. Display: `text-gradient-warm 135deg #fde047→#fb923c→#fff` (`index.css:16-20`). Headings via `PageShell` `h1` + `SectionLabel`.
- **Contrast:** Dark ground `#07090c` on white text; `high-contrast` modifier maps to `black/white/yellow` (`index.css:102-114`).

## Primitives (reuse)

| Primitive | File | Props/tokens to keep |
|---|---|---|
| `Button` | `pwa/src/components/Button.tsx` | `variant primary/secondary/ghost/danger`, `size md/lg`, `min-h-touch min-w-touch`, `focus-visible:ring-2`, `disabled:opacity-50` |
| `Card` | `pwa/src/components/Card.tsx` | `surface-card`, `border surface-border`, `rounded-2xl`, `p-4 sm:p-5` |
| `PageShell` | `pwa/src/components/PageShell.tsx` | sticky header, `h1 title`, `accent` line, `backTo` + `aria-label`, `width default/wide/full`, `SectionLabel` + `toggleActive/inactive`, `textareaClass` |
| `TabBar` | `pwa/src/components/TabBar.tsx` | `aria-label="Main navigation"`, `aria-current=page`, `safe-area-inset-bottom +12px`, `bg-surface-1/85 backdrop-blur` |
| `FocusTrap` | `pwa/src/core/a11y/FocusTrap.tsx` | Tab-wrap `a,button,input,select,textarea,[tabindex]`; restore trigger on close (P1-1) |
| `AriaLive` | `pwa/src/core/a11y/AriaLive.tsx` | dual `polite=status` / `assertive=alert`, 50 ms clear-then-set |

## Rules (additive)

1. **44 px target:** every interactive retains `min-h-touch min-w-touch` (WCAG 2.5.8).
2. **Focus:** keep `focus-visible:ring-2 ring-primary-400 ring-offset-surface-0`; add `focus-within` for custom toggles (`SettingsPage ToggleRow` → `role=switch`).
3. **Motion:** do not add new `animate-*` without respecting `prefers-reduced-motion` (`index.css:119-128` wins over `@layer utilities` because unlayered).
4. **Landmarks:** one `h1` per route via `PageShell`; article title is `h2`; TOC is `nav aria-label="Table of contents"` (`ReaderPage.tsx:382`).
5. **Announcements:** `announce(msg, politeness)` + `speechEngine.interrupt` for I/O; `aria-busy` while `analyzing`.

## Adding a component

1. Check `PageShell`/`Button`/`Card`/`TabBar` — can you compose them? 2. If new, place in `pwa/src/components/`, add `aria-label` + `focus-visible` + `min-h-touch`, and a minimal `*.test.tsx` for role/name.

## Spacing/typography scale (observed, not invented)

- Page gutters `px-4 sm:px-6`, sections `py-6 sm:py-8`, cards `gap-3`, header `py-3`. Heading `text-lg→xl→2xl→3xl`, body `text-sm→base`, mono `font-mono tabular-nums` for metrics. Keep `tracking-tight` on display, `tracking-[0.22em]` on `SectionLabel`.

Reference: `docs/research/oss-release-research.md` §3 (audit) is the remediation log for this file.
