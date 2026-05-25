import { create } from "zustand";
import { persist } from "zustand/middleware";

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

  // App state
  onboardingComplete: boolean;

  // Actions
  setSpeechRate: (rate: number) => void;
  setSpeechPitch: (pitch: number) => void;
  setSpeechVolume: (volume: number) => void;
  setVoiceURI: (uri: string | null) => void;
  setHighContrast: (enabled: boolean) => void;
  setFontSize: (size: number) => void;
  setHapticEnabled: (enabled: boolean) => void;
  setSpatialAudioEnabled: (enabled: boolean) => void;
  completeOnboarding: () => void;
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

      onboardingComplete: false,

      setSpeechRate: (rate) => set({ speechRate: rate }),
      setSpeechPitch: (pitch) => set({ speechPitch: pitch }),
      setSpeechVolume: (volume) => set({ speechVolume: volume }),
      setVoiceURI: (uri) => set({ voiceURI: uri }),
      setHighContrast: (enabled) => set({ highContrast: enabled }),
      setFontSize: (size) => set({ fontSize: Math.max(18, Math.min(32, size)) }),
      setHapticEnabled: (enabled) => set({ hapticEnabled: enabled }),
      setSpatialAudioEnabled: (enabled) => set({ spatialAudioEnabled: enabled }),
      completeOnboarding: () => set({ onboardingComplete: true }),
    }),
    {
      name: "isvisible-settings",
    }
  )
);
