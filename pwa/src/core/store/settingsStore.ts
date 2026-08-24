import { create } from "zustand";
import { persist } from "zustand/middleware";

export type PermissionState = "unknown" | "granted" | "denied";

export interface SetupStatus {
  camera: PermissionState;
  microphone: PermissionState;
  voiceConfirmed: boolean;
  offlineTablesCached: boolean;
}

const DEFAULT_SETUP_STATUS: SetupStatus = {
  camera: "unknown",
  microphone: "unknown",
  voiceConfirmed: false,
  offlineTablesCached: false,
};

// LastSession is the resume-on-launch breadcrumb. It is intentionally
// opaque — only the writing module knows the payload shape — so other
// modules can opt in over time without store churn.
export interface LastSession {
  route: string;
  // Free-form per-module payload (Reader: { url, title, chunkIndex, total })
  payload: Record<string, unknown>;
  updatedAt: number;
}

interface SettingsState {
  // Speech
  speechRate: number;
  speechPitch: number;
  speechVolume: number;
  voiceURI: string | null;

  // Display
  highContrast: boolean;
  fontSize: number; // 18-32px

  // Features
  hapticEnabled: boolean;
  spatialAudioEnabled: boolean;
  // Vibration duration multiplier: 0.5 gentle / 1.0 standard / 1.5 strong
  hapticIntensity: number;

  // Privacy
  // When false, AI Vision keeps only the most recent description in memory.
  // When true (default), the last 10 descriptions are retained within the
  // current page session — never persisted to disk regardless of this flag.
  visionRetainHistory: boolean;

  // Voice navigation
  // When true (default), recognized commands are echoed back ("I heard X")
  // before execution — builds trust on misfires. Power users can turn this
  // off to skip the ~1.4s confirmation delay.
  voiceConfirmAloud: boolean;

  // App state
  onboardingComplete: boolean;
  setupStatus: SetupStatus;
  lastSession: LastSession | null;

  // Actions
  setSpeechRate: (rate: number) => void;
  setSpeechPitch: (pitch: number) => void;
  setSpeechVolume: (volume: number) => void;
  setVoiceURI: (uri: string | null) => void;
  setHighContrast: (enabled: boolean) => void;
  setFontSize: (size: number) => void;
  setHapticEnabled: (enabled: boolean) => void;
  setSpatialAudioEnabled: (enabled: boolean) => void;
  setHapticIntensity: (intensity: number) => void;
  setVisionRetainHistory: (enabled: boolean) => void;
  setVoiceConfirmAloud: (enabled: boolean) => void;
  completeOnboarding: () => void;
  setSetupStatus: (patch: Partial<SetupStatus>) => void;
  resetSetupStatus: () => void;
  setLastSession: (session: LastSession | null) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      speechRate: 1.0,
      speechPitch: 1.0,
      speechVolume: 1.0,
      voiceURI: null,

      highContrast: false,
      fontSize: 20,

      hapticEnabled: true,
      spatialAudioEnabled: true,
      hapticIntensity: 1.0,

      visionRetainHistory: true,

      voiceConfirmAloud: true,

      onboardingComplete: false,
      setupStatus: { ...DEFAULT_SETUP_STATUS },
      lastSession: null,

      setSpeechRate: (rate) => set({ speechRate: rate }),
      setSpeechPitch: (pitch) => set({ speechPitch: pitch }),
      setSpeechVolume: (volume) => set({ speechVolume: volume }),
      setVoiceURI: (uri) => set({ voiceURI: uri }),
      setHighContrast: (enabled) => set({ highContrast: enabled }),
      setFontSize: (size) => set({ fontSize: Math.max(18, Math.min(32, size)) }),
      setHapticEnabled: (enabled) => set({ hapticEnabled: enabled }),
      setSpatialAudioEnabled: (enabled) => set({ spatialAudioEnabled: enabled }),
      setHapticIntensity: (intensity) =>
        set({ hapticIntensity: Math.max(0.5, Math.min(1.5, intensity)) }),
      setVisionRetainHistory: (enabled) => set({ visionRetainHistory: enabled }),
      setVoiceConfirmAloud: (enabled) => set({ voiceConfirmAloud: enabled }),
      completeOnboarding: () => set({ onboardingComplete: true }),
      setSetupStatus: (patch) =>
        set((state) => ({ setupStatus: { ...state.setupStatus, ...patch } })),
      resetSetupStatus: () => set({ setupStatus: { ...DEFAULT_SETUP_STATUS } }),
      setLastSession: (session) => set({ lastSession: session }),
    }),
    {
      name: "isvisible-settings",
      version: 6,
      // v0 → v1: add setupStatus default.
      // v1 → v2: add visionRetainHistory default.
      // v2 → v3: add lastSession default (null).
      // v3 → v4: add voiceConfirmAloud default (true).
      // v4 → v5: add setupStatus.offlineTablesCached default.
      // v5 → v6: add hapticIntensity default (1.0).
      // Keep each step tolerant — any missing field just gets the default appended.
      migrate: (persisted, version) => {
        const base = (persisted ?? {}) as Partial<SettingsState>;
        const next: Partial<SettingsState> = { ...base };
        if (version < 1 || !next.setupStatus) {
          next.setupStatus = { ...DEFAULT_SETUP_STATUS };
        } else {
          next.setupStatus = { ...DEFAULT_SETUP_STATUS, ...next.setupStatus };
        }
        if (version < 2 || typeof next.visionRetainHistory !== "boolean") {
          next.visionRetainHistory = true;
        }
        if (version < 3 || next.lastSession === undefined) {
          next.lastSession = null;
        }
        if (version < 4 || typeof next.voiceConfirmAloud !== "boolean") {
          next.voiceConfirmAloud = true;
        }
        if (
          version < 5 ||
          typeof next.setupStatus?.offlineTablesCached !== "boolean"
        ) {
          next.setupStatus = {
            ...DEFAULT_SETUP_STATUS,
            ...next.setupStatus,
            offlineTablesCached: false,
          };
        }
        if (version < 6 || typeof next.hapticIntensity !== "number") {
          next.hapticIntensity = 1.0;
        }
        return next as SettingsState;
      },
    }
  )
);
