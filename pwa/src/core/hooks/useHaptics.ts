import { useCallback, useEffect } from "react";
import { hapticEngine } from "@/core/haptics/HapticEngine";
import { useSettingsStore } from "@/core/store/settingsStore";

/**
 * React hook wrapper around HapticEngine.
 * Respects user's haptic preference and intensity settings.
 */
export function useHaptics() {
  const enabled = useSettingsStore((s) => s.hapticEnabled);
  const intensity = useSettingsStore((s) => s.hapticIntensity);

  useEffect(() => {
    hapticEngine.setIntensity(intensity);
  }, [intensity]);

  const vibrateForRole = useCallback(
    (role: string) => {
      if (enabled) hapticEngine.vibrateForRole(role);
    },
    [enabled]
  );

  const vibrate = useCallback(
    (pattern: number[]) => {
      if (enabled) hapticEngine.vibrate(pattern);
    },
    [enabled]
  );

  const stop = useCallback(() => {
    hapticEngine.stop();
  }, []);

  return {
    vibrateForRole,
    vibrate,
    stop,
    isSupported: hapticEngine.isSupported,
    isEnabled: enabled,
    intensity,
  };
}
