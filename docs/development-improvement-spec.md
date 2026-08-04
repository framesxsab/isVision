# Development Improvement Spec

## Purpose

This spec turns the current isVisible PWA and prototype roadmap into practical implementation work. The focus is to improve usefulness, reliability, accessibility, and hardware readiness without changing the project direction.

## Current Baseline

The project already includes:

- React/Vite PWA with routed modules for Home, Onboarding, Settings, Touch Explorer, AI Vision, Reader, Voice Navigation, Tactile Output Lab, Tactile Drill, and Tactile Graphics.
- Persistent settings through `isvisible-settings` and tactile state through `isvisible-tactile`.
- Liblouis-backed Grade 2 braille translation for English UEB, French, and German, with lazy-loaded offline assets.
- Web Serial, WebHID scaffold, compact frame export, and an OS-side `tactile_serve.py` bridge.
- Accessibility and offline Playwright coverage plus unit tests for tactile, privacy, capability, and command logic.

## Priorities

### P0: Onboarding Recovery and Permissions Center

Problem:
Users can skip or complete onboarding, but there is no guided recovery path that combines permissions, voice setup, haptics, and offline preparation in one place.

Implementation:

- Add a "Run setup again" action in Settings that routes to `/onboarding?restart=1`.
- Preserve `onboardingComplete` unless the user explicitly resets all data.
- Extend Onboarding with a final readiness checklist:
  - speech voice selected or system default confirmed
  - camera permission state
  - microphone permission state
  - haptics availability
  - offline table cache state
- Add a "Finish later" path that marks setup complete but records incomplete setup items.
- Store setup status in `settingsStore`, for example:

```ts
setupStatus: {
  camera: "unknown" | "granted" | "denied";
  microphone: "unknown" | "granted" | "denied";
  voiceConfirmed: boolean;
  offlineTablesCached: boolean;
}
```

Affected files:

- `pwa/src/pages/OnboardingPage.tsx`
- `pwa/src/pages/SettingsPage.tsx`
- `pwa/src/core/store/settingsStore.ts`
- `pwa/tests/a11y.spec.ts`
- New `pwa/tests/onboarding-setup.spec.ts`

Acceptance criteria:

- User can relaunch onboarding from Settings after completing it.
- Permission denial does not block setup completion.
- Screen reader receives clear live status for each permission result.
- Setup can be completed with keyboard only.
- Playwright verifies complete, skip, restart, and denied-permission flows.

### P1: Unified App Status and Capability Diagnostics

Problem:
Capability hints exist in individual modules, but users need one place to understand what will and will not work on their current browser/device.

Implementation:

- Add a Settings section called "Device capabilities".
- Reuse `detectCapability` from `pwa/src/core/utils/capabilities.ts`.
- Show support state for:
  - camera
  - microphone / speech recognition
  - speech synthesis
  - vibration
  - clipboard
  - Web Serial
  - WebHID
  - service worker / Cache Storage
- Each row should include a short next action, not only "supported" or "unsupported".

Affected files:

- `pwa/src/pages/SettingsPage.tsx`
- `pwa/src/core/utils/capabilities.ts`
- `pwa/src/core/utils/capabilities.test.ts`
- New `pwa/tests/settings-capabilities.spec.ts`

Acceptance criteria:

- All capability rows are navigable and understandable with screen readers.
- Missing APIs produce practical browser/device guidance.
- Tests cover at least one available and one unavailable branch per browser-controlled API.

### P1: Reader to Tactile Workflow Upgrade

Problem:
The Reader can send the current paragraph to the Tactile Lab, but the reading workflow should support repeated study tasks such as moving paragraph by paragraph and sending selected ranges.

Implementation:

- Add paragraph navigation controls in Reader:
  - previous paragraph
  - next paragraph
  - repeat paragraph
  - send current paragraph to Tactile Lab
- Add optional "Send selected text to Tactile Lab" when the user has selected text inside the article.
- Persist last reader position per loaded URL in session storage.
- Add speech announcements for current paragraph number and handoff status.

Affected files:

- `pwa/src/modules/reader/ReaderPage.tsx`
- `pwa/src/modules/reader/useReader.ts`
- `pwa/src/modules/tactile-output/tactileStore.ts`
- New `pwa/tests/reader-tactile-handoff.spec.ts`

Acceptance criteria:

- Keyboard-only users can move through paragraphs and send text to Tactile Lab.
- Handoff opens `/tactile-output` with the expected text loaded.
- Empty selections are ignored with a clear status message.
- Reader position restores during the same browser session.

### P2: Tactile Drill Learning Metrics

Problem:
Tactile Drill tracks score and recent history, but it does not yet turn mistakes into a training plan.

Implementation:

- Add per-symbol accuracy aggregation.
- Add "Practice mistakes" drill mode using recent incorrect answers.
- Add CSV fields for mode, difficulty, prompt kind, expected answer, user answer, correctness, timestamp, and response time.
- Add an optional "speech only" versus "speech plus tactile" comparison summary.

Affected files:

- `pwa/src/modules/tactile-output/drillState.ts`
- `pwa/src/modules/tactile-output/TactileDrillPage.tsx`
- `pwa/src/modules/tactile-output/tactileStore.ts`
- `pwa/src/modules/tactile-output/drillState.test.ts`
- `pwa/tests/tactile-drill.spec.ts`

Acceptance criteria:

- Incorrect answers are available as a dedicated practice queue.
- Accuracy summary updates after each answer.
- CSV export includes enough data for user testing analysis.
- Existing drill persistence remains backward-compatible.

### P2: Hardware Emulator and Protocol Verification

Problem:
The protocol is documented and tested with stubs, but contributors need a visible emulator to verify frame output without hardware.

Implementation:

- Add a `/hardware-emulator` route or a Tactile Lab panel that can load compact protocol text.
- Render one-cell, four-cell, and eight-cell frame playback.
- Support play, pause, step forward, step backward, speed, and loop.
- Validate malformed compact protocol lines and report exact line numbers.
- Reuse existing frame serializers/parsers where possible; add parser if missing.

Affected files:

- `pwa/src/modules/tactile-output/brailleFrames.ts`
- `pwa/src/modules/tactile-output/TactileOutputPage.tsx`
- `pwa/src/App.tsx`
- New `pwa/src/modules/tactile-output/HardwareEmulatorPage.tsx`
- New unit tests for compact protocol parsing
- New `pwa/tests/hardware-emulator.spec.ts`

Acceptance criteria:

- Contributor can paste exported frames and inspect playback without a device.
- Invalid input gives actionable line-level errors.
- Emulator is keyboard accessible and screen-reader labeled.
- Build and Playwright tests pass.

### P3: AI Vision Privacy and Result Management

Problem:
AI Vision keeps useful description history in memory, but users need stronger control over what is retained, repeated, copied, or cleared.

Implementation:

- Add explicit "Clear vision history".
- Add "Copy last description" and "Send last description to Reader/Tactile Lab".
- Add a Settings privacy toggle for whether AI Vision descriptions may persist during the session.
- Ensure camera stream stops on route change, page hide, and unmount.

Affected files:

- `pwa/src/modules/ai-vision/VisionAssistantPage.tsx`
- `pwa/src/modules/ai-vision/useVisionAssistant.ts`
- `pwa/src/core/privacy/disclosures.ts`
- `pwa/tests/settings-privacy.spec.ts`
- New `pwa/tests/vision-history.spec.ts`

Acceptance criteria:

- User can clear history and receives a live confirmation.
- Camera tracks stop when leaving AI Vision.
- No provider API keys or raw images are exposed to the browser bundle.
- Privacy disclosure describes the exact data flow.

## Non-Functional Requirements

- All new controls must be keyboard reachable and have accessible names.
- Dynamic status must use `aria-live` or existing speech announcements where appropriate.
- No browser-only capability may fail silently; unsupported APIs need visible and spoken fallback guidance.
- Offline-critical flows must work after service worker install, or clearly state what is unavailable.
- Persisted state changes must be version-tolerant and not break existing localStorage payloads.
- New UI should follow existing component patterns in `Button`, `Card`, `TabBar`, and Settings sections.

## Test Plan

Run before merging:

```bash
cd pwa
npm run build
npm test
npm run test:a11y
```

Add or update tests with each feature:

- Unit tests for store migrations, frame parsing, drill metrics, and capability helpers.
- Playwright tests for keyboard navigation, screen-reader labels, persistence, offline paths, and permission-denied branches.
- Manual mobile smoke test on at least one narrow viewport, using the existing mobile audit script if it remains part of the workflow.

## Suggested Implementation Order

1. P0 Onboarding Recovery and Permissions Center.
2. P1 Device Capability Diagnostics.
3. P1 Reader to Tactile Workflow Upgrade.
4. P2 Tactile Drill Learning Metrics.
5. P2 Hardware Emulator and Protocol Verification.
6. P3 AI Vision Privacy and Result Management.

This order improves user setup and debuggability first, then strengthens the tactile learning and hardware paths.
