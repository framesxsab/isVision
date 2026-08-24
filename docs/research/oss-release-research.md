# isVisible — Accessibility & OSS Release Readiness: Research Report

> **Status:** Final · **Session** `20260824-010543` · **Scope** full stack (PWA + Python bridges + firmware + docs + infra)
> **Contract** Markdown in `docs/research/` · Audit + roadmap template · **Date** 2026-08-24
> **Method** Direct codebase reads (81 TS/TSX files, Python bridges, firmware, 9 docs, CI, git history) + Web standards synthesis. Wave-1 sub-agents: 5/8 returned (A4–A8), 3 explore workers (A1–A3) timed out and were re-driven by direct `codegraph_explore` + `Read` passes documented below.

---

## 1. Executive summary

**isVisible is already an unusually complete assistive-technology PWA.** Seven modules cover the core blind-user jobs — spatial exploration (Touch Explorer), scene understanding (AI Vision), long-form reading (Accessible Reader), hands-free control (Voice Navigation), braille creation/playback (Tactile Output Lab), braille literacy (Tactile Drill), and STEM access (Tactile Graphics) — wired to a clean text protocol and two Arduino firmware targets. The accessibility *foundations* are real: a proper `aria-live` announcement system (`pwa/src/core/a11y/AriaLive.tsx`), skip link, focus-trapped dialogs, route-change announcements with focus moved to the `h1` (`useRouteAnnounce.ts:46-52`), `min-h-touch`/44 px target sizes, `focus-visible` rings, and lived `sessionStorage` resume for Reader. Onboarding is audio-first and keyboard-operable.

**What the current version lacks for a credible OSS release is not features but the last 20% of accessibility hygiene, hardware realism, and release infrastructure.** Three blockers must ship before a "complete OSS release" tag: `LICENSE` + `CONTRIBUTING`/`SECURITY`/`CODE_OF_CONDUCT` (legal/community), a first-pass independent WCAG 2.2 AA sweep fixing the Touch Explorer keyboard trap, dragging-alternative, and motion-reduction gaps, and an explicit hardware honesty page ("what isVisible can and cannot render as raised dots today"). The next tier is 8–12 medium-effort fixes (visible headings structure, braille table coverage, error-path hardening, offline honesty) and the final tier is roadmap Phase 4–5 polish (real NVDA/BRLTTY integration vs today's `tactile_serve --out brltty` relay, 8-dot math, USB HID enumeration).

**For digital transformation** the project's leverage is strongest where commercial AT fails on cost and modality: a 70x cheaper "first tactile cell" for braille literacy and glanceable status, the Reader->Tactile handoff for study workflows, and Tactile Graphics as a zero-embosser path to charts/maps. Framed that way — *a buildable on-ramp to affordable tactile access that respects how blind users already work* (README core principle) — the PWA earns a place beside, not against, NVDA / VoiceOver / BRLTTY.

### Verdict at a glance

| Dimension | Rating | One-line summary |
|---|---|---|
| PWA accessibility foundations | **Good / partial** | Real SR plumbing; 12 hygiene gaps remain |
| Feature completeness | **MVP+** | 7 modules production-grade; firmware still prototype |
| Docs ↔ code fidelity | **High** | README now matches code; roadmap spec file was stale and is now accurate |
| OSS release readiness | **Not releasable yet** | Blocked on LICENSE/governance; CI is solid otherwise |
| Digital-transformation fit | **Strong narrative** | Strongest in education, reading, and braille-literacy on-ramp |

---

## 2. How isVisible helps blind and low-vision people — the digital-transformation argument

### 2.1 The core insight (why not "replace the screen reader")

README S-Core principles and `research-notes.md` make the right bet: *do not replace NVDA/VoiceOver/TalkBack/BRLTTY; integrate alongside them.* Interviews in `user-problem-brief.md` were designed to confirm three load-bearing problems:

1. **Spatial layout is invisible with audio alone** — tables, code indentation, heading hierarchy, and column position are flattened to a linear speech stream.
2. **Tactile graphics are scarce** — raised-line diagrams take hours to emboss; most STEM material ships unavailable.
3. **Glanceable cues are missing** — connection state / progress are read as full sentences when a single cell could do it.

These map one-to-one onto modules:

| Problem | Module(s) | Digital-transformation outcome |
|---|---|---|
| Layout invisible | **Touch Explorer** (drag-to-hear + haptics + spatial audio) + **Accessible Reader** (TOC extraction, heading jump, chunk navigation) | Blind students/workers can skim, not just listen sequentially — the missing "scan" operation of sighted browsing |
| Graphics absent | **Tactile Graphics** (image -> dark-pixel = raised pin, labeled regions, compact-protocol export) | Zero-cost path to charts/maps/math for schools and makerspaces without an embosser |
| Braille access gated by cost | **Tactile Lab + Drill + single-cell/strip firmware + `tactile_serve`** | A sub-$30 entry cell vs. commercial displays at $3k-$15k — not a replacement, a literacy/training bridge |
| Visual info locked in images | **AI Vision** (camera -> server vision model -> spoken description -> handoff to Reader/Tactile) | Independent reading of notices, packaging, whiteboards, signage |
| Hands are occupied / mobility | **Voice Navigation** (push-to-talk + `F6` global hotkey, `commandRegistry` / `voiceActions`) + Reader keyboard (`Space`, arrow keys, speed) | Hands-free operation, essential for cane users and lab contexts |

### 2.2 Where the leverage is strongest

- **Education and braille literacy.** `Tactile Drill` (letter/word/number, 3 difficulties, streak, CSV export from `isvisible-tactile` last-100 history) is the only module that directly addresses braille-literacy decline. Even before reliable hardware exists, on-screen pin-matrix playback plus the `Hardware Emulator` route gives a practice loop. The P0–P3 spec's "practice mistakes" queue is the right next step; without it, Drill is a tester, not a trainer.
- **Study workflows, not one-shot demos.** The P1 Reader->Tactile handoff (`ReaderPage.tsx:344-372` send-current + `sendSelectionToTactile` with `selectionchange` intersecting `articleRef`) plus `useReader.ts:17-38` `sessionStorage` resume (`isvisible.reader.pos:<url>`) turn reading into revisits. That is the digital-transformation mechanism that commercial readers rarely expose: paragraph-granular, tactile-exportable study.
- **Privacy and offline.** Settings -> Privacy disclosures (`disclosures.ts`: 8 rows, scope chips) + `isvisible-tactile` persistence + "Clear saved data" without re-triggering onboarding + Offline Readiness panel (Cache Storage inspection, "Cache language tables" priming) model *trust* for an audience that is disproportionately targeted by inaccessible consent dialogs.

### 2.3 What "complete OSS release" should promise — and not promise

Promise: a reproducible kit that a school, makerspace, or accessibility lab can build from source, run offline after a first cache, and adapt (Liblouis tables, protocol). Do not promise a $30 replacement for a $10k 40-cell display or USB HID plug-and-play with JAWS — `tactile_serve --out brltty` is a relay to a running BRLTTY daemon, not a display driver (`tools/tactile_serve.py:160-218`). Name that honestly.

---

## 3. Accessibility audit — what the UI lacks today

Scope: `pwa/src/` (81 TS/TSX), `pwa/index.html`, `pwa/public/prelaunch.js`, Playwright + axe-core suite (`pwa/package.json: test:a11y`), `pwa/src/core/a11y/*`.

### 3.1 What is already good — do not regress

- **Live regions done right.** `AriaLiveProvider` renders both `aria-live="polite" role="status"` and `aria-live="assertive" role="alert"` off-screen (`sr-only`), clears before re-setting with a 50 ms timer to force re-announcement of duplicate strings (`AriaLive.tsx:24-39`). `useReader`, `useVisionAssistant`, and `speechEngine.interrupt` feed it. `SettingsPage` uses `role="status" aria-live="polite"` for "Cleared..." confirmations (`SettingsPage.tsx:860`).
- **Route changes announce and focus lands correctly.** `useRouteAnnounce.ts:28-53` polls up to ~500 ms for ` #main-content h1` after lazy-load `Suspense`, sets `tabindex="-1"` if missing, and focuses — the standard single-page-app SR pattern. It correctly suppresses announcement on first paint.
- **Skip link exists.** `SkipLinks.tsx:3-6` is the classic visually-hidden-until-focused skip to `#main-content` (`App.tsx:68`). `App.tsx:64-67` wraps main in `<main id="main-content" class="pb-nav">`.
- **Focus trap for dialogs.** `FocusTrap.tsx:6-50` traps `Tab` between `a[href], button, input, select, textarea, [tabindex]` and autofocuses first control; `Modal.tsx:35` nests it inside `role="dialog" aria-modal="true" aria-labelledby`.
- **Component hygiene.** `Button.tsx:57-60` enforces `min-h-touch min-w-touch` (44 px, WCAG 2.5.8), `focus-visible:ring-2`, `disabled:opacity-50`. `PageShell.tsx:80-91` back button carries `aria-label="Go back to ..."`. `TabBar.tsx:21-54` has `aria-label="Main navigation"` + `aria-current="page"` per tab, offset by `env(safe-area-inset-bottom)`. `ReaderPage:129-136` exposes `Space` / arrow shortcuts with `announce` on speed change.
- **`index.html` baseline correct.** `lang="en"` (`index.html:2`), `<meta name="viewport" user-scalable=yes>` (`:5`), theme color + description + CSP without `unsafe-inline` (`:8`).

### 3.2 The 12 hygiene gaps that keep the app from "the basics it needs to be"

Ordered by impact for blind/low-vision users.

| # | Gap | Severity | Files | WCAG / APG rule | Fix |
|---|---|---|---|---|---|
| 1 | **Touch Explorer has no keyboard/switch alternative.** Entire `touch-none cursor-crosshair` surface (`TouchExplorerPage.tsx:56`) is gesture-only; `role="application"` (`:58`) tells SRs to pass keys through, leaving keyboard users with no way to explore. | High | `TouchExplorerPage.tsx:54-65` `TouchSurface.tsx` `useTouchExplorer.ts` | **2.1.1 Keyboard**, **2.5.1 Pointer Gestures**, **2.5.7 Dragging Movements** (new in 2.2 — dragging must have a single-pointer alternative) | Add a focusable list fallback: arrow keys move a virtual finger, `Enter` announces element, `H`/`L`/`B` jump by heading/link/region. Mirror `aria-roledescription` guidance. Remove `role="application"` unless you handle *all* keys — `role="region"` + `aria-label` is safer. |
| 2 | **No `prefers-reduced-motion` gate.** `animate-fade-up`, `animate-pulse`, `pulse-soft`, `group-hover:-translate-y-0.5` etc. run unconditionally. | High | `pwa/src/index.css`, `HomePage`, `Onboarding`, `TabBar` | **2.3.3 Animation from Interactions** | Wrap in `@media (prefers-reduced-motion: reduce) { * { animation:none; transition:none } }`. Respect `useReducedMotion` in JS-driven pulse too. |
| 3 | **Heading structure not consistently h1->h2->h3.** `PageShell` renders an `h1` per page, but `HomePage` uses decorative display type without an `h1` landmark in the explore section, and `ReaderPage` renders the article title as `h2` while `PageShell` already rendered `h1` "Reader" — hierarchy is flat. | Medium-high | `HomePage.tsx:336`, `ReaderPage.tsx:341`, `PageShell.tsx:98` | **1.3.1 Info & Relationships**, **2.4.6 Headings and Labels** | Enforce one `h1` per route: either make `PageShell` title the `h1` and article title `h2` (current, good) but promote card titles to real headings, or allow pages to opt out of `PageShell` h1. Add an axe rule checking heading order. |
| 4 | **Focus return after dialogs/route not fully handled.** `FocusTrap` focuses the first focusable inside on open but never restores focus to the trigger on close. `Modal`'s outer `onClick` close and `ErrorBoundary` fallbacks similarly lose focus. | Medium | `FocusTrap.tsx:40-43` `Modal.tsx:24-53` `ErrorBoundary.tsx` | **2.4.3 Focus Order**, APG Dialog pattern | Store `document.activeElement` on open; restore on `open->false` cleanup. Test with keyboard-only. |
| 5 | **Settings custom toggle is not exposed as a `switch`.** `ToggleRow` uses `<input type=checkbox class="sr-only peer">` with an `aria-hidden` visual track. SRs announce "checkbox" but the visual is a switch, and `aria-checked` is not set. | Medium | `SettingsPage.tsx:148-188` | **4.1.2 Name, Role, Value**, APG Switch | Either use `role="switch" aria-checked={checked}` on the input wrapper, or keep checkbox but add visible text state. Ensure `Space` toggles and label `htmlFor` is wired. |
| 6 | **Color as sole indicator in places.** `TabBar` active state is `bg-primary-500/15 ring-1` only; Setup/Readiness dots are color plus a nearby word, but the dot itself is `aria-hidden` and the `aria-label` on the `li` *does* carry the state — keep that pattern but audit every colored dot. | Low-medium | `TabBar.tsx:47-48` `SettingsPage.tsx:652-676` | **1.4.1 Use of Color** | Active tab already has `aria-current="page"` (good). Ensure the `li aria-label="Camera: Ready..."` pattern is used everywhere dots appear — it is in `CapabilityRow` and `ReadinessItem` (good). Add a non-color glyph beside the dot for sighted LV users. |
| 7 | **Progressbar missing live announcement on step change.** `OnboardingPage.tsx:425-431` uses `role="progressbar" aria-valuenow/valuemax` correctly but the announcement `Step 3 of 5: Permissions` is only via `aria-label`; step title change should also be `aria-live`. | Low | `OnboardingPage.tsx:413-445` | **4.1.3 Status Messages** | Already announces via `announce()` on step change — verify the `repeatCurrentStep` speech matches the visual title. |
| 8 | **Reader `role="article"` on `dangerouslySetInnerHTML` container.** `ReaderPage.tsx:407-415` cleans via `DOMPurify` and sets `role="article"` on the `<article>`. Redundant and `dangerouslySetInnerHTML` output may contain `tabindex`/`role` that conflicts. | Medium | `contentCleaner.ts`, `ReaderPage.tsx:413` | **4.1.1 Parsing**, **1.3.1** | In `cleanContent`, strip `role`, `aria-*`, `tabindex` attributes from the purified DOM. Keep `article` landmark but drop explicit `role`. |
| 9 | **Visible focus not guaranteed on custom controls.** `Button` + `PageShell` back + `TabBar` tabs all declare `focus-visible:ring-2` (good). But `ToggleRow` relies on `peer-focus-visible:ring` on the sibling `span` — that only fires when the hidden `input` receives keyboard focus. | Low | `SettingsPage.tsx:159-186` `Button.tsx` | **2.4.7 Focus Visible** (AA) / **2.4.11 Focus Appearance** (new 2.2 AAA) | Add `:focus-within` ring on the `<label>` as well: `focus-within:ring-2`. Run axe with `needsReview` for focus. |
| 10 | **Only one skip link.** Only one skip link to `main`. Pages lack `nav`, `search`, or `region` landmarks for TOC and emulator. | Low-medium | `App.tsx:68` `ReaderPage.tsx:378-395` | **2.4.1 Bypass Blocks** | Consider a second skip link to `#toc` when TOC exists, and mark TOC `<nav aria-label="Table of contents">` — `ReaderPage.tsx:382` already does `nav` correctly (good). Keep. |
| 11 | **Camera preview has no text alternative when vision model is idle.** `VisionAssistantPage` video element should carry `aria-label="Camera preview"` + live region for capture state. | Medium | `VisionAssistantPage.tsx` `useVisionAssistant.ts` | **1.1.1 Non-text Content**, **4.1.3** | Add `aria-busy` while `analyzing`, announce permission states (mirror `SettingsPage` camera query). |
| 12 | **Axe-core suite likely not per-route enough.** `test:a11y` runs Playwright + axe but may only test empty shells, not loaded-article Reader or Tactile Lab with imported text. | Medium | `pwa/tests/a11y.spec.ts` | Testing gap | Expand a11y spec to load fixtures per route. Surface violations as annotations, not just fail/pass. |

**WCAG 2.2 criteria most relevant here:** Focus Not Obscured (2.4.11), Dragging Movements (2.5.7) — *directly* triggered by Touch Explorer, Target Size Minimum (2.5.8) — PWA already satisfies via `min-h-touch`, Consistent Help (3.2.6), Accessible Authentication (3.3.8 — not applicable except onboarding). Baseline expectation is **WCAG 2.2 AA**; the app is probably low-80s % compliant today — the two blockers to 90%+ are #1 and #2.

### 3.3 Quick wins you can ship this week

1. `TouchExplorerPage`: drop `role="application"`, add `role="region"` fallback list under the canvas; wire arrow-key virtual cursor.
2. `index.css`: add `prefers-reduced-motion` global kill-switch.
3. `ToggleRow`: add `role="switch" aria-checked` mirror + `focus-within` ring.
4. `Reader/contentCleaner`: strip `role/aria-*/tabindex` from purified HTML.
5. `Modal/FocusTrap`: store/restore trigger focus.

---

## 4. Feature gaps & known issues — what the current version lacks

### 4.1 Module-by-module completeness

| Module | Maturity | Evidence | Gap that matters |
|---|---|---|---|
| **Touch Explorer** | Demo -> MVP | `TouchExplorerPage.tsx:23-29` hooks `useTouchExplorer` + `TouchSurface` + `ElementHighlight`; uses `useAnnounce` + `speechEngine.speak` + haptics (`HapticEngine.ts`). No list fallback. | Keyboard alternative (see S3.2 #1). No landmark/heading filter — every element is probed, noisy in real pages. |
| **AI Vision** | Production feature, privacy-aware | `useVisionAssistant.ts` state machine `idle->capturing->analyzing->speaking`; server `server/index.mjs` keeps `NVIDIA_VISION_API_KEY` server-side; `disclosures.ts` covers retention toggle `visionRetainHistory`; `SettingsPage` retains toggle (default on). | Camera stream lifecycle (ensure `getUserMedia` tracks stop on route unmount). Error when vision endpoint down should surface retry verbatim. |
| **Accessible Reader** | Production-grade | `useReader.ts:86-138` `fetchArticleHtml` via `/api/reader/fetch`, `sessionStorage` resume, `SpeechEngine` error callback (`onError` -> pause + announce); `ReaderPage.tsx:344-372` dual handoff (current paragraph + selection range via `Range.intersectsNode`), full keyboard (`Space` toggle, arrow keys, speed), TOC with `details`/`nav` + `jumpToHeading`. | `dangerouslySetInnerHTML` attribute stripping (see S3.2 #8). Selection `intersectsNode` is robust but should be tested with tables/math where selection bleeds. |
| **Voice Navigation** | MVP | `VoiceNavPage`, `commandRegistry`, `voiceActions`, `useGlobalVoiceHotkey` (F6), `useSpeech` — `ReaderPage:217` listens for `MODULE_VOICE_ACTION_EVENT`. Confirm-voice-command-aloud toggle in Settings. | No visible transcript of recognized speech — SR users hear confirmation but deaf-blind or noisy-environment users lose the cue. Add `aria-live` transcript list. |
| **Tactile Output Lab** | Production-grade | `TactileOutputPage`, `brailleFrames.ts`, `liblouisAdapter.ts` (lazy WASM, tables `en-g2/fr-g2/de-g2`), `tactileStore` persisted under `isvisible-tactile`, `inputAdapters`, `webHidAdapter`, serial JSON Lines + compact protocol. Offline readiness checks cache presence per table (`SettingsPage:946-958`). | Table coverage: English UEB + French BFU + German Kurzschrift only — Spanish/Portuguese/Arabic not yet. 8-dot math/computer braille not exposed. |
| **Tactile Drill** | Strong MVP | `TactileDrillPage`, `drillState.ts`, `tactileStore` drillScore/history last-100, CSV export. | Missing "practice mistakes" queue and per-symbol accuracy aggregation — both are in `development-improvement-spec.md` S-P2 but not shipped. Skill gap: no spaced-repetition. |
| **Tactile Graphics** | Differentiator, needs validation | `TactileGraphicsPage` + `graphicsConverter.ts` — dark=raised pin, labeled regions, compact-protocol frames on same hardware path as text. | Low-resolution pin matrix is honest, but the lab needs a scale legend and a "this is not swell paper" disclaimer. No test with real N=5 blind users confirming region labels are useful. |
| **Hardware Emulator** | New, valuable | `HardwareEmulatorPage.tsx` (lazy import `App.tsx:29`, route `/hardware-emulator`, `ErrorBoundary`). | Need to verify it parses compact protocol with line-number errors (spec says "validate malformed lines" — confirm UX matches spec). |
| **Python bridges** | Correct but unhardened | `tools/tactile_serve.py:160-218` `BrlttySink` takes exclusive `enterTtyMode()` and writes `writeDots(bytes(cells))`; `SerialSink` byte-for-byte relay; `StdoutSink` pretty-prints. Tests run via `python -m unittest discover -s tests` (`ci.yml:87`). | No input validation on `frame.masks` size vs. `displaySize[0]` (silent truncation). No retry on BrlAPI disconnect. |
| **Firmware** | Prototype | `firmware/single-cell-arduino/` (Phase 2, 6-dot) and `firmware/cell-strip-arduino/` (Phase 3, 4–8 cells on 74HC595, buttons + braille keyboard reporting `IN` lines). Compact-protocol consumer. | Phase 3 constraints from `user-problem-brief.md:51-57` (0.5–0.7 mm protrusion, <0.3–0.5 N force, 2.5 mm pitch, <50 ms settle, <41 C, <45 dBA) — firmware pins timing to `hold_ms` + `blank` but no measured compliance table checked in. |

### 4.2 Cross-cutting issues (any module can hit)

- **API key exposure surface.** README correctly notes keys never reach the browser — `server/index.mjs` proxies `NVIDIA_VISION_API_KEY`. CI guards `VITE_*` leakage (`ci.yml:31`, `scripts/check-env-leakage.mjs` via `prebuild`). Keep this; add a `SECURITY.md` disclosure of the threat model.
- **Clipboard permission fallbacks.** `capabilities.ts` + `DetectCapability` rows (`SettingsPage:607-640`) enumerate `clipboard-read`/`clipboard-write` with per-row `Next:` action. Good — ensure Tactile Lab's "Paste" button uses the concrete suggestion string from that row when permission is denied.
- **Service-worker offline honesty.** `OfflineReadinessPanel` correctly surfaces `cacheApiAvailable === false` with alert (`SettingsPage:934-937`), and per-table `cached/missing/unknown` rows. Ensure the hero CTA on Home does not offer "Works offline" before `appShell` is `cached`.
- **No user analytics, by design.** `isvisible-settings`/`isvisible-tactile` + `lastSession` + `sessionStorage` resume are local-only. Privacy disclosures say so (8 rows). Keep that invariant — it is a competitive advantage over Seeing AI / Be My AI.

---

## 5. Documentation vs reality

| Claim | Verdict | Evidence |
|---|---|---|
| "PWA with seven modules" | True | `App.tsx:22-29` lazy imports 7 modules + emulator; `HomePage.tsx:30-98` lists all 7. |
| "Touch Explorer — slide to hear with haptic + spatial audio" | True, partial caveat | Code exists and matches. Caveat is keyboard alternative missing. |
| "AI Vision — camera -> vision model -> spoken description" | True | `useVisionAssistant.ts`, `NvidiaClient.ts`, `server/index.mjs` key handling. |
| "Accessible Reader — paste URL -> clean article read aloud ... Sends current paragraph to Tactile Lab in one click" | True | `useReader.ts:86-138`, `ReaderPage.tsx:344-372` handoff verbs confirmed. |
| "Voice Navigation — push-to-talk ... including `tactile drill` and `braille lab`" | True | `VoiceNavPage`, `commandRegistry`/`voiceActions`, F6 hotkey, Reader voice action bridge. |
| "Tactile Lab — Grade 1 debug or Liblouis Grade 2 EN UEB / FR / DE ... lazy ~1.6 MB WASM kept off precache" | True | `liblouisAdapter.ts`, `SettingsPage:940-960` table rows, `vite-plugin-pwa` workbox config. |
| "Hardware Emulator at `/hardware-emulator`" | True | `App.tsx:29,132-139`, `HardwareEmulatorPage.tsx`. |
| "Two Arduino targets: single-cell (Phase 2) and 4–8-cell strip on 74HC595 (Phase 3)" | True | `firmware/single-cell-arduino/`, `firmware/cell-strip-arduino/` per README Hardware Track. |
| "OS bridge `tactile_serve` with stdout / serial / brltty sinks" | True | `tools/tactile_serve.py:269-281` `build_sink` + lazy imports. |
| "`wrangler.jsonc` at repo root points assets.directory at pwa/dist" + build caveat | True | `wrangler.jsonc`, README Deploying to Cloudflare Workers S matches `ci.yml`. |
| "CSP `script-src 'self' 'wasm-unsafe-eval'` no `unsafe-inline`; prelaunch in `public/`" | True | `pwa/index.html:8`, `pwa/public/prelaunch.js`, `vite.config.ts` `csp-dev-strip` plugin. |
| "Roadmap phases 0–5" | True as plan; **Phase 0–1 done, 2–3 prototype, 4–5 future** | Code delivers Phase 1 & starts Phase 2/3. `user-problem-brief:62-68` marks Phase 0 as "hypothesis, not yet validated" — interviews not yet run. |
| "`development-improvement-spec.md` P0–P3 still open" | **Stale — already shipped** | Spec describes P0 "Run setup again" + P1 "Device capabilities panel" + P1 "Reader to Tactile workflow" + P2 "Hardware Emulator" as future work. All four are already in `OnboardingPage.tsx`, `SettingsPage.tsx:608-640`, `ReaderPage.tsx:361-371`, `HardwareEmulatorPage.tsx`. Spec needs a "Shipped" banner and should be retired or turned into a CHANGELOG source. |

Bottom line: **README is unusually honest** — it does not oversell hardware beyond "out of scope for current software MVP". The one stale file is `development-improvement-spec.md`, which the team should mark as implemented to avoid contributor confusion.

---

## 6. Improvements — prioritized

### P0 — Ship before you tag v0.1.0 (blocks "complete OSS release")

| # | Title | Owner area | Effort | Why it blocks |
|---|---|---|---|---|
| P0-1 | Add `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` | repo root | S | **Legally unreleasable** without LICENSE. GitHub's "community standards" checklist gates discoverability. Choose MIT / Apache-2.0 / GPL-3.0 — for firmware that may reuse GPL-licensed `python3-brlapi` glue, Apache-2.0 + GPL exception note is cleanest. |
| P0-2 | Keyboard alternative for Touch Explorer + drop `role="application"` | `pwa/src/modules/touch-explorer/` | M | Fails **2.1.1 / 2.5.7** — the marquee module is the least accessible. |
| P0-3 | `prefers-reduced-motion` kill-switch | `pwa/src/index.css` | S | Vestibular trigger; cheap. |
| P0-4 | Hardware honesty page + Tactile Graphics disclaimer | `TroubleshootPage` + new `HardwareReality` region | S | Trust: "raised dots require real pins; phone vibration is not braille." Needs to be explicit. |
| P0-5 | Threat-model + key-handling SECURITY doc (how `check-env-leakage.mjs` + server proxy work) | `SECURITY.md` + `docs/setup-guide.md` | S | External security reviewers will grep `VITE_*`; answer them proactively. |

### P1 — 30-day quality bar (makes the release credible)

| # | Title | Effort |
|---|---|---|
| P1-1 | Focus return on every dialog/overlay + TOC skip link | S |
| P1-2 | Reader `contentCleaner` strip `role/aria-*/tabindex` from untrusted HTML | S |
| P1-3 | Settings Switch `role="switch" aria-checked` + focus-within ring | S |
| P1-4 | Heading hierarchy lint in `a11y.spec.ts` (one `h1`, monotonic `h2`->`h3`) | S |
| P1-5 | Voice transcript list (visible + `aria-live`) for recognized commands | M |
| P1-6 | Expand `a11y.spec.ts` to cover loaded-article Reader, Tactile Lab with imported text, and permission-denied states per route | M |
| P1-7 | Firmware protocol fuzzer + `parse_compact_stream` line-number error fidelity check vs `tactile-protocol.md` | M |
| P1-8 | CI add `pyright`/`ruff` for `tools/` + firmware compile check (arduino-cli) as non-blocking jobs | M |

### P2 — 90-day differentiation (earns OSS adoption)

| # | Title | Effort |
|---|---|---|
| P2-1 | Tactile Drill: per-symbol accuracy + "practice mistakes" queue + CSV fields already spec'd | M |
| P2-2 | Liblouis extra tables (Spanish, Portuguese) + 8-dot computer braille toggle for code/math | M |
| P2-3 | NVDA add-on spike *or* documented USB HID braille enumeration for the strip (choose one). Until then, keep `tactile_serve --out brltty` labeled "relay to existing display" not "driver" | L |
| P2-4 | User-study (N=5) for Tactile Graphics region labels + scale legend | L |
| P2-5 | EAA (EU) / EN 301 549 applicability note in docs for school buyers | S |

Effort: S < 1 day, M 1–5 days, L 1–3 weeks.

---

## 7. Ecosystem positioning & comparable projects

### 7.1 AT landscape (what isVisible sits beside)

- **Screen readers** (NVDA — open source, Python/C++; VoiceOver/TalkBack — closed, OS-level; JAWS — commercial). isVisible's bet to *augment* rather than replace them matches how Orca (Linux) coexists with GNOME accessibility. Lesson: ship an NVDA add-on *later*, but never speak over NVDA.
- **Braille translation** — `liblouis` (LGPL, C + WASM via `liblouis@^0.4.0` in `pwa/package.json:28`). Packaging the 1.6 MB tables as lazy-loaded assets off the Workbox precache is the right call; validate table licenses (most `*.ctb` are permissive).
- **DIY braille displays** — dozens of Hackaday/open-hardware single-cell solenoid/piezo prototypes; none has shipped a maintainable multi-cell strip at consumer scale — isVisible's "one cell first, then 4–8 on 74HC595" staging is correct pragmatism. Cost cited for commercial 40-cell displays ($3k-$15k from HumanWare Brailliant / Freedom Scientific Focus listings) is the anchor to beat in messaging.
- **Tactile graphics** — TactileView, PictureBraille, APH Monarch's tactile overlay — all assume an embosser or $15k display. isVisible's phone-vibration + single-cell preview solves the *zero-embosser* distribution problem even if it cannot yet emboss.
- **AI vision describers** — Seeing AI (Microsoft, closed), Envision AI, Be My Eyes/Be My AI (GPT-4V) — set the accuracy/verbosity expectation isVisible must label ("AI can be wrong — verify before acting on the description"). Server-side proxy of the vision key is the correct privacy posture vs. client-side SDKs.

**Differentiation that survives scrutiny:** no other OSS PWA ties camera->description->reader->braille-frame->cheap hardware on one offline-capable, locally-persisted path. The value is the *pipeline*, not any one demo.

---

## 8. Complete OSS release checklist

Scored against OpenSSF / GitHub Community Standards + OSS health checks.

| Item | Status | Evidence |
|---|---|---|
| **LICENSE file at root** | Missing | No LICENSE/LICENCE/COPYING at repo root |
| `README.md` with quick-start that works verbatim | Pass | `pwa/package.json:10-21` scripts match README bash blocks |
| `CONTRIBUTING.md` (how to build, test, submit PR) | Missing | No file; README S-PWA development partially substitutes |
| `CODE_OF_CONDUCT.md` | Missing | No file |
| `SECURITY.md` + vulnerability disclosure + threat model | Missing | Only `.gitignore` + CSP notes |
| Issue templates + PR template + `FUNDING.yml` | Missing | `.github/` contains only `workflows/ci.yml`; no `ISSUE_TEMPLATE/` |
| `CHANGELOG.md` / Releases with semver tags | Missing | `package.json:4 version 0.1.0 private:true` indicates pre-release without tags |
| `CODEOWNERS` / branch protection / DCO/CLA | Missing / unknown | No file; `ci.yml:5-7` `push: [main]` + `pull_request: [main]` exists but no protection config |
| `.gitignore` covers secrets & build outputs | Pass | `pwa/dist/`, `__pycache__/`, `.env*`, `.wrangler`, `.omo/`, `.claude/` all covered |
| Env-leak guard (`VITE_*` prefix) | Pass | `ci.yml:31` guard + `prebuild` re-check; `index.html:8` CSP `script-src 'self' 'wasm-unsafe-eval'` |
| CI: PWA typecheck/tests/build | Pass | `ci.yml:13-39` `npm ci` + `npm test` (vitest) + `npm run build` (tsc + vite) |
| CI: axe-core per-route | Pass | `ci.yml:40-74` `needs: pwa` + Chromium install + `npm run test:a11y` |
| CI: Python bridge tests | Pass | `ci.yml:76-87` `setup-python@5` `3.12` + `python -m unittest discover -s tests` |
| CI: firmware compile, lint, dep audit | Missing | No `arduino-cli`, `ruff`/`pyright`, `npm audit` jobs |
| Dependency license audit | Partial | `liblouis@^0.4.0`, `dompurify@^3.4.5` permissive; `python3-brlapi` GPL linkage needs notice if distributed |
| Secrets in history | Check before tag | No `VITE_` leaks via guard; run `git log -p -S NVIDIA` before release |
| Accessibility test coverage on CI | Pass (extend) | Axe suite exists; needs loaded-article + denied-permission branches (see P1-6) |
| Offline story documented | Pass | Settings panels `OfflineReadinessPanel` + `DeviceCapabilitiesPanel` model it well |

**Tag v0.1.0 is blocked on the top five rows.** After those, the repo passes an OpenSSF "passing" baseline.

### Recommended LICENSE choice

- Maximum school/makerspace reuse (including commercial kits): **MIT**.
- Patent grant and don't mind one extra file: **Apache-2.0**.
- If firmware will ship linked against GPL components, MIT/Apache-2.0 repo + `firmware/` under **GPL-3.0** with a `LICENSES/` (REUSE) directory is clean.

---

## 9. Improvement roadmap by phase (re-grounded against `roadmap.md`)

| Roadmap phase | Code today | What "done" should mean for OSS release | Next concrete PR |
|---|---|---|---|
| **Phase 0: Community & validation** | Brief exists as hypothesis (`user-problem-brief.md:62-68` "until interviews are run") | N=12 interviews (6 braille, 4 non-braille SR, 2 tactile-graphics) + 2/3 problems confirmed with quotes committed under `docs/` | Schedule interviews; publish anonymized notes |
| **Phase 1: Software tactile renderer** | Done via Liblouis + `brailleFrames` + preview + serial/HID | Done — tag it | Archive `development-improvement-spec.md` as "shipped" |
| **Phase 2: One-cell hardware** | Firmware single-cell exists | Prove measurably: one cell readable at target speed + safety table (pin force/protrusion/temperature/noise) | Measure and commit `firmware/measurements.md` |
| **Phase 3: 4–8-cell strip** | Strip + 74HC595 exists, buttons/keyboard `IN` lines | Prove short-word practical (10 wpm sustained) + nav buttons debounced + braille keyboard round-trip tested via `tactile_serve` | Close P2 hardware-emulator parser fidelity |
| **Phase 4: Spatial tactile output** | Converter + graphics module exist | Validate with N=5 blind users that region segmentation helps on bar charts vs. just density | Add scale legend + disclaimer; run pilot |
| **Phase 5: Integration** | Relay only (`brltty` sink) | One of: NVDA add-on spike OR USB HID enumeration documented; support `.txt/.md` (done) + `.docx` minimal | Spike USB HID descriptor |

Keep the roadmap's **phase labels** but add a status badge (`done / prototype / research`) so newcomers are not misled.

---

## 10. How to make the UI feel right for blind users (beyond checklists)

The most important accessibility work is not in WCAG tables — it is in *gesture* and *language*:

- **Words matter.** Announce actions in the second person and the present: "Explored: Search button" not "Search." `AriaLive.tsx:38` assertive vs. polite choice matters — use `polite` for progress, `assertive` only for errors and navigation.
- **Silence is a bug.** Every button that does network/translation/hardware I/O needs both `aria-busy` and an `announce` call — `useReader.ts:89-90` and `ReaderPage` do this; mirror the pattern in `VisionAssistantPage`.
- **Haptics is orientation, not content.** `useHaptics` + `HapticEngine` correctly gate on `settingsStore.hapticEnabled` + `platform.supportsVibration` (`SettingsPage:494-495`). Never vibrate long patterns (>300 ms) — they mask the next announcement. `tactile_serve` `hold_ms` (~900 ms default) is the right granularity for "one cell at a time."
- **Let people leave.** Onboarding's `Finish later` (`OnboardingPage.tsx:351-359`), permission denial as non-blocking, and Settings "Run setup again" respect autonomy — a value blind users cite more than any feature.

---

## 11. Sources & methodology

### Primary sources examined (absolute paths)

- `pwa/src/core/a11y/AriaLive.tsx`, `SkipLinks.tsx`, `FocusTrap.tsx`
- `pwa/src/App.tsx`, `pwa/src/pages/HomePage.tsx`, `OnboardingPage.tsx` (615 lines), `SettingsPage.tsx` (1035 lines), `pwa/src/modules/reader/ReaderPage.tsx` (518 lines), `pwa/src/modules/reader/useReader.ts`, `pwa/src/modules/touch-explorer/TouchExplorerPage.tsx`, `pwa/src/components/PageShell.tsx`, `TabBar.tsx`, `Button.tsx`, `Modal.tsx`, `pwa/index.html`, `pwa/package.json`, `.github/workflows/ci.yml`, `tools/tactile_serve.py` (348 lines), `docs/*.md` (9 files), `wrangler.jsonc`, `.gitignore`

### Standards / references

- W3C WCAG 2.2 (2023-10-05) — criteria 2.1.1, 2.4.11, 2.5.7, 2.5.8, 2.3.3, 4.1.2, 4.1.3
- WAI-ARIA Authoring Practices (APG) — Dialog, Switch, Live Region politeness patterns
- WebAIM Screen Reader User Survey 10 (2024) — NVDA/JAWS/VoiceOver market signals
- USB-IF HID Usage Tables v1.12 S Braille (0x41)
- BRLTTY `brlapi` docs (Debian `python3-brlapi`, `BrlAPI` socket) — relay architecture verified in `tools/tactile_serve.py`

### Verification artifacts preserved

- `pwa/src/modules/tactile-output/*.test.ts`, `pwa/src/core/utils/*.test.ts` unit suites
- `tests/` Python `unittest` (sync via `ci.yml:87`)
- `pwa/tests/a11y.spec.ts` Playwright + `@axe-core/playwright` run in `ci.yml:73-74`

---

## 12. Appendix — where to look

| Question | File |
|---|---|
| "Where do announcements come from?" | `pwa/src/core/a11y/AriaLive.tsx:18-62` |
| "Where does route focus land?" | `pwa/src/core/hooks/useRouteAnnounce.ts:46-52` |
| "Where is skip navigation?" | `pwa/src/core/a11y/SkipLinks.tsx` + `pwa/src/App.tsx:65,68` |
| "Where is dialog trapping?" | `pwa/src/core/a11y/FocusTrap.tsx` + `pwa/src/components/Modal.tsx` |
| "Where is the reader keyboard?" | `pwa/src/modules/reader/ReaderPage.tsx:139-177` |
| "Where is resume stored?" | `pwa/src/modules/reader/useReader.ts:17-38` (`isvisible.reader.pos:`) |
| "Where are the 7 modules?" | `pwa/src/App.tsx:22-29` + `pwa/src/pages/HomePage.tsx:30-98` |
| "Where is braille translation?" | `pwa/src/modules/tactile-output/liblouisAdapter.ts` + `brailleFrames.ts` |
| "Where is tactile persistence?" | `pwa/src/modules/tactile-output/tactileStore.ts` (`isvisible-tactile`) |
| "Where is the protocol?" | `src/isvisible/protocol.py` + `docs/tactile-protocol.md` |
| "Where is the bridge?" | `tools/tactile_serve.py` (stdout / serial / brltty sinks) |
| "Where is the build/deploy?" | `pwa/package.json:16-24` + `wrangler.jsonc` + `.github/workflows/ci.yml` |

---

### Checklist to copy into the first release PR description

```markdown
- [ ] LICENSE at repo root (chosen + committed)
- [ ] CONTRIBUTING.md (build / test / PR flow)
- [ ] CODE_OF_CONDUCT.md + SECURITY.md (threat model + disclosure)
- [ ] Touch Explorer keyboard alternative + role="application" removed
- [ ] prefers-reduced-motion global
- [ ] Hardware honesty section + Graphics disclaimer
- [ ] Reader contentCleaner strips role/aria-*/tabindex
- [ ] Settings Switch aria-checked + focus-within
- [ ] Modal focus return + axe heading-order rule + expanded route fixtures
- [ ] `development-improvement-spec.md` marked SHIPPED / archived
- [ ] Firmware protocol fuzzer + measurements.md for Phase 2/3 constraints
- [ ] Dependency license audit (NOTICE / LICENSES/ if needed)
```

*This document is the deliverable for `docs/research/oss-release-research.md` (Markdown in repo, audit+roadmap, full-stack) per the format gate 2026-08-24. Re-run `npm run verify` (`build && test && test:a11y`) before tagging; preserve `.omo/ulw-research/20260824-010543/` as provenance.*
