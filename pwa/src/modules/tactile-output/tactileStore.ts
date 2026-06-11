// Persisted state for the Tactile Lab and Tactile Drill pages.
//
// Lives on its own zustand-persist key so the existing settingsStore
// (`isvisible-settings`) stays untouched — its key shape is referenced by
// Playwright tests and the onboarding gate, and we don't want to risk a
// schema drift breaking either.
//
// What we persist:
//   - Lab: grade, language, group size, output format, hold_ms,
//     blank-between-frames, and the explicit "remember imports" preference.
//     Imported clipboard/file/handoff text is persisted only when that
//     preference is enabled.
//   - Drill: cumulative score, last drill mode, last speech mode.
//
// What we deliberately don't persist: the textarea contents as the user
// types (would thrash localStorage), translator busy/error flags, cells, and
// any in-flight state. Those are derived or session-only.

import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { LiblouisTableId } from "./liblouisAdapter";
import type { Difficulty, DrillAttempt, DrillMode, DrillScore } from "./drillState";
import { INITIAL_SCORE, MAX_HISTORY, recordAttempt } from "./drillState";

export type TranslatorMode = "g1" | "g2";
export type OutputFormat = "json" | "compact";
export type DrillSpeechMode = "silent" | "speech" | "speech+tactile";

interface TactileState {
  // Tactile Lab
  lastImportedText: string;
  lastImportSource: string;
  persistImportedText: boolean;
  translatorMode: TranslatorMode;
  language: LiblouisTableId;
  groupSize: number;
  outputFormat: OutputFormat;
  holdMs: number;
  blankBetweenFrames: boolean;

  // Tactile Drill
  drillScore: DrillScore;
  drillMode: DrillMode;
  drillSpeechMode: DrillSpeechMode;
  drillDifficulty: Difficulty;
  drillHistory: DrillAttempt[];

  // Actions
  rememberImportedText: (text: string, source: string) => void;
  setPersistImportedText: (enabled: boolean) => void;
  setTranslatorMode: (mode: TranslatorMode) => void;
  setLanguage: (id: LiblouisTableId) => void;
  setGroupSize: (size: number) => void;
  setOutputFormat: (format: OutputFormat) => void;
  setHoldMs: (ms: number) => void;
  setBlankBetweenFrames: (enabled: boolean) => void;
  setDrillScore: (score: DrillScore) => void;
  setDrillMode: (mode: DrillMode) => void;
  setDrillSpeechMode: (mode: DrillSpeechMode) => void;
  setDrillDifficulty: (difficulty: Difficulty) => void;
  pushDrillAttempt: (attempt: DrillAttempt) => void;
  resetDrillScore: () => void;
}

export const TACTILE_STORE_KEY = "isvisible-tactile";

// We accept anything via setters but clamp at the same boundaries the UI does
// so a hostile localStorage value can't drive the page into a bad state on
// next load.
const HOLD_MS_MIN = 100;
const HOLD_MS_MAX = 5000;
const VALID_GROUP_SIZES = new Set([1, 4, 8]);
const VALID_TRANSLATOR_MODES = new Set<TranslatorMode>(["g1", "g2"]);
const VALID_LANGUAGES = new Set<LiblouisTableId>(["en-g2", "en-g1", "fr-g2", "de-g2"]);
const VALID_OUTPUT_FORMATS = new Set<OutputFormat>(["compact", "json"]);
const VALID_DRILL_MODES = new Set<DrillMode>([
  "letter",
  "word",
  "number",
  "punctuation",
  "mixed",
]);
const VALID_SPEECH_MODES = new Set<DrillSpeechMode>(["silent", "speech", "speech+tactile"]);
const VALID_DIFFICULTIES = new Set<Difficulty>(["easy", "normal", "hard"]);

function clampHoldMs(value: number): number {
  if (!Number.isFinite(value)) return 900;
  return Math.max(HOLD_MS_MIN, Math.min(HOLD_MS_MAX, Math.round(value)));
}

function migratePersistedState(persistedState: unknown, version: number): Partial<TactileState> {
  if (!persistedState || typeof persistedState !== "object") {
    return {};
  }

  const state = persistedState as Partial<TactileState>;
  const persistImportedText = version >= 3 ? Boolean(state.persistImportedText) : false;

  return {
    ...state,
    persistImportedText,
    lastImportedText:
      persistImportedText && typeof state.lastImportedText === "string"
        ? state.lastImportedText
        : "",
    lastImportSource:
      persistImportedText && typeof state.lastImportSource === "string"
        ? state.lastImportSource
        : "",
  };
}

export const useTactileStore = create<TactileState>()(
  persist(
    (set) => ({
      // Lab defaults
      lastImportedText: "",
      lastImportSource: "",
      persistImportedText: false,
      translatorMode: "g1",
      language: "en-g2",
      groupSize: 1,
      outputFormat: "compact",
      holdMs: 900,
      blankBetweenFrames: true,

      // Drill defaults
      drillScore: INITIAL_SCORE,
      drillMode: "letter",
      drillSpeechMode: "silent",
      drillDifficulty: "normal",
      drillHistory: [],

      rememberImportedText: (text, source) =>
        set({ lastImportedText: text, lastImportSource: source }),
      setPersistImportedText: (enabled) =>
        set({
          persistImportedText: Boolean(enabled),
          ...(enabled ? {} : { lastImportedText: "", lastImportSource: "" }),
        }),
      setTranslatorMode: (mode) =>
        set({ translatorMode: VALID_TRANSLATOR_MODES.has(mode) ? mode : "g1" }),
      setLanguage: (id) => set({ language: VALID_LANGUAGES.has(id) ? id : "en-g2" }),
      setGroupSize: (size) => set({ groupSize: VALID_GROUP_SIZES.has(size) ? size : 1 }),
      setOutputFormat: (format) =>
        set({ outputFormat: VALID_OUTPUT_FORMATS.has(format) ? format : "compact" }),
      setHoldMs: (ms) => set({ holdMs: clampHoldMs(ms) }),
      setBlankBetweenFrames: (enabled) => set({ blankBetweenFrames: Boolean(enabled) }),
      setDrillScore: (score) => set({ drillScore: score }),
      setDrillMode: (mode) =>
        set({ drillMode: VALID_DRILL_MODES.has(mode) ? mode : "letter" }),
      setDrillSpeechMode: (mode) =>
        set({ drillSpeechMode: VALID_SPEECH_MODES.has(mode) ? mode : "silent" }),
      setDrillDifficulty: (difficulty) =>
        set({
          drillDifficulty: VALID_DIFFICULTIES.has(difficulty) ? difficulty : "normal",
        }),
      pushDrillAttempt: (attempt) =>
        set((s) => ({ drillHistory: recordAttempt(s.drillHistory, attempt) })),
      // Reset both score and the recent-attempt history together — a learner
      // pressing Reset wants a clean slate, not a clean score with stale
      // mistakes still listed below it.
      resetDrillScore: () => set({ drillScore: INITIAL_SCORE, drillHistory: [] }),
    }),
    {
      name: TACTILE_STORE_KEY,
      version: 3,
      migrate: migratePersistedState,
      partialize: (state) => ({
        ...state,
        lastImportedText: state.persistImportedText ? state.lastImportedText : "",
        lastImportSource: state.persistImportedText ? state.lastImportSource : "",
      }),
    }
  )
);
// Re-export for callers that want the same upper bound used inside the store.
export { MAX_HISTORY };
