/**
 * HapticEngine — Provides distinct vibration patterns for different
 * UI element types. Each role has a unique tactile signature so
 * blind users can feel the difference between buttons, links, headings, etc.
 *
 * Only works on Android (navigator.vibrate). iOS has no web vibration support.
 * Gracefully degrades to no-op on unsupported platforms.
 */

import { platform } from "@/core/utils/platform";

// Vibration patterns in milliseconds [vibrate, pause, vibrate, ...]
const HAPTIC_PATTERNS: Record<string, number[]> = {
  button: [50],                    // Short firm tap
  link: [25, 40, 25],             // Double light tap
  heading: [80],                   // Long firm tap
  image: [15, 30, 15, 30, 15],   // Triple gentle pulse
  textbox: [40, 20, 40],          // Two medium taps
  searchbox: [40, 20, 40],
  checkbox: [30, 50, 60],         // Short then long
  radio: [30, 50, 60],
  slider: [20, 15, 20, 15, 20],  // Rapid vibration
  combobox: [40, 20, 40],
  list: [15, 30, 15],
  listitem: [15],                  // Very light tap
  navigation: [60, 30, 30],       // Landmark pattern
  main: [60, 30, 30],
  form: [60, 30, 30],
  text: [10],                     // Barely perceptible
  dialog: [80, 40, 80],           // Alert pattern
};

const DEFAULT_PATTERN = [20];

class HapticEngineImpl {
  private enabled = true;
  private intensity = 1.0;

  get isSupported(): boolean {
    return platform.supportsVibration;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /** Scale all pattern durations (vibrations and pauses) by this multiplier. */
  setIntensity(intensity: number) {
    this.intensity = Math.max(0.5, Math.min(1.5, intensity));
  }

  /** Vibrate with the pattern associated with the given ARIA role. */
  vibrateForRole(role: string) {
    if (!this.enabled || !this.isSupported) return;
    const pattern = HAPTIC_PATTERNS[role] ?? DEFAULT_PATTERN;
    navigator.vibrate(this.scalePattern(pattern));
  }

  /** Play a custom vibration pattern. */
  vibrate(pattern: number[]) {
    if (!this.enabled || !this.isSupported) return;
    navigator.vibrate(this.scalePattern(pattern));
  }

  private scalePattern(pattern: number[]): number[] {
    if (this.intensity === 1.0) return pattern;
    return pattern.map((ms) => Math.max(1, Math.round(ms * this.intensity)));
  }

  /** Stop any ongoing vibration. */
  stop() {
    if (!this.isSupported) return;
    navigator.vibrate(0);
  }
}

export const hapticEngine = new HapticEngineImpl();
