# UX Impact Plan — Real-World Improvements

> Companion to `development-improvement-spec.md`. The spec lists *what* could be built.
> This doc captures *which pieces will actually change a blind user's daily life*, in what order, and why.
> Use this as the working brief before any new feature work on isVisible.

---

## Guiding Principle

We are not optimizing for a feature checklist. We are optimizing for the **moment a blind user keeps the app installed instead of deleting it.** Every item below is scored on one question:

> "Will the user *feel* this difference in their daily life — or is this a developer-shaped feature?"

If the answer is "developer-shaped," it gets deferred regardless of P-rank in the original spec.

---

## Re-Ranked Priority List

### TIER 1 — Real life-changers (ship first)

#### 1. Onboarding Recovery + Contextual Permission Prompts
- **Source:** P0 in spec + the *inline* part of P1.
- **Why it matters:** A blind user who denies camera once on first launch is currently stranded with no spoken recovery path. AI Vision silently fails. Trust collapses on day 1. This is not a feature, it is **baseline dignity**.
- **What good looks like:**
  - "Run setup again" entry in Settings → routes to `/onboarding?restart=1`.
  - `setupStatus` persisted in `settingsStore` (camera / microphone / voiceConfirmed / offlineTablesCached).
  - When a module's required capability is missing, the module's own screen says (in spoken voice): "Camera is blocked. Tap here to fix it." — NOT a generic diagnostics dashboard.
  - All permission states announced via `aria-live`.
  - Keyboard-only path through every recovery step.
- **Files:**
  - `pwa/src/pages/OnboardingPage.tsx`
  - `pwa/src/pages/SettingsPage.tsx` — add "Run setup again" row in Features panel
  - `pwa/src/core/store/settingsStore.ts` — add `setupStatus` shape, version-tolerant migration
  - `pwa/src/modules/ai-vision/VisionAssistantPage.tsx` — inline permission-denied state with fix CTA
  - `pwa/src/modules/voice-nav/VoiceNavPage.tsx` — same pattern for mic
  - New: `pwa/tests/onboarding-setup.spec.ts`
- **Acceptance:**
  - User can relaunch onboarding from Settings.
  - Permission denial does not block setup completion ("Finish later" path).
  - Screen reader gets clear live status for each permission result.
  - Each blocked module shows an inline, actionable fix (not just "unavailable").

---

#### 2. AI Vision "Send to / Copy / Clear last description"
- **Source:** P3 in spec, **promoted to Tier 1.**
- **Why it matters:** This is the loop that converts a demo into a daily tool. User points camera at a medicine label → hears description → wants to: (a) re-read it slowly in Reader, (b) copy and share with a sighted family member, (c) study it tactilely. Without these handoffs, every AI Vision result is throwaway.
- **What good looks like:**
  - "Copy last description" button — copies to clipboard, announces "Copied."
  - "Send last to Reader" — navigates to `/reader` with the description preloaded.
  - "Send last to Tactile Lab" — navigates to `/tactile-output` with the text loaded.
  - "Clear vision history" — wipes session memory, announces confirmation.
  - Privacy toggle in Settings: "Keep AI Vision descriptions during session" (default on).
  - Camera tracks **stop on route change, page hide, and unmount** — verified.
- **Files:**
  - `pwa/src/modules/ai-vision/VisionAssistantPage.tsx`
  - `pwa/src/modules/ai-vision/useVisionAssistant.ts` — expose `lastDescription`, `clearHistory`
  - `pwa/src/modules/reader/useReader.ts` — accept `?preload=` query param
  - `pwa/src/modules/tactile-output/tactileStore.ts` — handoff entry point
  - `pwa/src/pages/SettingsPage.tsx` — privacy toggle row
  - New: `pwa/tests/vision-history.spec.ts`
- **Acceptance:**
  - User can clear history with live confirmation.
  - Camera tracks audit-clean on every exit path.
  - No raw images or API keys in the browser bundle (re-verify `check-env-leakage` passes).
  - Handoffs are keyboard-only navigable.

---

#### 3. Audio Polish Layer (NOT in original spec — add it)
- **Source:** Missing from spec. The single highest-leverage bundle for this audience.
- **Why it matters:** For blind users, **audio quality > visual polish.** Three sub-items, all small, all transformative:
  - **3a. First-launch audio before paint.** Pre-React `<audio>` element saying "Welcome to isVisible. Tap anywhere to begin." The very first thing the user experiences is currently silence while the bundle loads. Costs ~10 lines in `index.html` + a short MP3.
  - **3b. Speech queue / interruption discipline.** Today: if a user presses F6 mid-announcement, behavior of overlap vs. preempt is undefined. Audit `speechSynthesis.speak` call sites; centralize through a `speakManager` that cancels in-flight on user-initiated speech (button taps, F6) but queues for status/aria-live updates.
  - **3c. Voice-nav echo-back.** When recognition fires, speak what was heard *before* acting: "I heard 'open reader' — opening Reader now." Builds trust; today silent misfires feel like the app is broken.
- **Files:**
  - `pwa/index.html` — pre-React welcome audio (gated by sessionStorage so it plays once per session)
  - New: `pwa/src/core/speech/speakManager.ts` — single source of truth for `speechSynthesis`
  - Refactor all `speechSynthesis.speak()` call sites to go through `speakManager`
  - `pwa/src/modules/voice-nav/VoiceNavPage.tsx` — echo-back before dispatch
  - `pwa/src/core/hooks/useGlobalVoiceHotkey.ts` — coordinate with speakManager
  - New: `pwa/src/core/speech/speakManager.test.ts`
- **Acceptance:**
  - Cold-start: audio plays before React mounts on first session.
  - Pressing F6 mid-announcement cleanly preempts; status updates queue without overlapping user-initiated speech.
  - Every voice command speaks the recognized text before executing.
  - Existing speech rate/pitch/voice settings still apply via the manager.

---

### TIER 2 — High-impact for the learning audience

#### 4. Reader Paragraph Navigation + Position Memory
- **Source:** P1 in spec, kept at Tier 2.
- **Why it matters:** For students using Reader to study, paragraph-by-paragraph control is the daily workflow. Position memory ("resume paragraph 7") makes the app feel like it respects the user's time.
- **Scope:** Per the original spec — prev/next/repeat/send-to-tactile, optional send-selected-text, sessionStorage per-URL position.
- **Files:** Per spec — `ReaderPage.tsx`, `useReader.ts`, `tactileStore.ts`, new `reader-tactile-handoff.spec.ts`.

#### 5. Tactile Drill: Practice Mistakes + Per-symbol Accuracy
- **Source:** P2 in spec, kept at Tier 2.
- **Why it matters:** Converts the drill from a toy into a teacher. Spaced repetition of actual error letters is how people learn braille.
- **Scope:** Per spec — accuracy aggregation, "Practice mistakes" mode, richer CSV.
- **Files:** Per spec.

#### 6. Resume-on-Launch
- **Source:** Missing from spec — add as small adjunct to #4.
- **Why it matters:** On cold start, offer "Resume Reader, paragraph 7" or "Resume Drill, mistakes mode." ~20 lines. Feels like the app knows the user.
- **Files:**
  - `pwa/src/core/store/settingsStore.ts` — add `lastSession: { route, payload }`
  - `pwa/src/pages/HomePage.tsx` — render resume card above Workspace when present

---

### TIER 3 — Reframe before building

#### 7. Capability Diagnostics (REFRAME)
- **Source:** P1 in spec — keep the *function*, drop the *dashboard*.
- **Verdict:** A long supported/unsupported list reads like a tax form for the actual user. The real win — inline contextual messages — is folded into **#1**. A Settings sub-page listing all capabilities is acceptable as a triage/support tool but is **not a primary user need.** Build it only after Tier 1 ships, and label it "Troubleshoot" rather than "Diagnostics."

---

### TIER 4 — Defer

#### 8. Hardware Emulator
- Pure contributor tooling. Important for project longevity (lets contributors iterate without owning hardware) but invisible to end users. Defer until Tier 1–2 ship.

---

## Suggested Implementation Order

Each bullet is a self-contained PR-sized chunk.

1. **Tier 1, item 1a — `setupStatus` store shape + migration** (small, foundational)
2. **Tier 1, item 1b — Onboarding restart route + "Finish later" path**
3. **Tier 1, item 1c — Inline permission-blocked states on AI Vision and Voice Nav**
4. **Tier 1, item 3a — First-launch audio + sessionStorage gate** (smallest user-visible win, ship fast)
5. **Tier 1, item 3b — `speakManager` central API + refactor call sites**
6. **Tier 1, item 3c — Voice-nav echo-back through `speakManager`**
7. **Tier 1, item 2a — AI Vision: `lastDescription` exposure + copy / clear / send-to handoffs**
8. **Tier 1, item 2b — AI Vision privacy toggle + camera-stop audit**
9. **Tier 2, item 4 — Reader paragraph nav + position memory**
10. **Tier 2, item 6 — Resume-on-launch card** (depends on #9 for Reader payload)
11. **Tier 2, item 5 — Tactile Drill mistakes mode + accuracy**
12. **Tier 3, item 7 — Optional "Troubleshoot" page in Settings**
13. **Tier 4, item 8 — Hardware emulator (only if contributor demand exists)**

---

## Cross-Cutting Non-Negotiables

Every change above must satisfy these, no exceptions:

- **WCAG AA contrast + 48×48 touch targets** (current baseline — don't regress).
- **Keyboard-only path** for every new control.
- **`aria-live` or spoken announcement** for every state change a sighted user would see.
- **Camera/mic stop on unmount, route change, and `visibilitychange`** — verified per module.
- **No API keys or raw images** in the browser bundle (`scripts/check-env-leakage.mjs` must keep passing).
- **Version-tolerant `localStorage` migrations** — never break an existing user's saved state.
- **Speech goes through `speakManager`** once it exists — no scattered `speechSynthesis.speak()` calls.

---

## Test Plan (per PR)

```bash
cd pwa
npm run build       # type-check + bundle
npm test            # unit tests
npm run test:a11y   # Playwright a11y suite
node mobile-audit.mjs   # mobile viewport audit (375 / 390 / 430)
```

Plus per-item Playwright coverage as listed in the file sections above.

---

## Decision Log

| Date       | Decision                                                                                              | Rationale                                                                                                  |
|------------|-------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| 2026-05-28 | Promoted P3 (AI Vision handoffs) to Tier 1.                                                            | The handoff loop is the moment AI Vision becomes a daily tool vs. a one-shot demo.                          |
| 2026-05-28 | Added Audio Polish Layer (not in spec) to Tier 1.                                                      | For this audience, audio quality dominates visual polish; cheapest, highest-leverage bundle.                |
| 2026-05-28 | Reframed P1 Capability Diagnostics dashboard → inline contextual messages folded into Onboarding Recovery. | A dashboard reads like a tax form to a non-technical blind user. Inline fix CTAs are the real win.        |
| 2026-05-28 | Deferred Hardware Emulator (P2 in spec) to Tier 4.                                                     | Contributor tooling, invisible to end users; ship user-facing wins first.                                   |

---

## Open Questions (revisit before Tier 2)

- Should "Resume Reader" survive across browser sessions (localStorage) or only within a session (sessionStorage)? Privacy implications either way.
- Voice-nav echo-back: does the extra speech latency hurt power users? Consider a settings toggle ("Confirm voice commands aloud") defaulting on.
- First-launch audio: licensing for a short MP3, or generate via `speechSynthesis` at load (which itself needs a tap to unblock on iOS)? Likely the latter, gated on first tap.
