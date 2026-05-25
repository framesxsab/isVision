import { useCallback } from "react";
import { spatialAudio } from "@/core/audio/SpatialAudio";
import { useSettingsStore } from "@/core/store/settingsStore";

/**
 * React hook wrapper around SpatialAudio.
 * Respects user's spatial audio preference setting.
 */
export function useSpatialAudio() {
  const enabled = useSettingsStore((s) => s.spatialAudioEnabled);

  const playAtPosition = useCallback(
    (x: number, y: number, screenWidth: number, screenHeight: number, role: string) => {
      if (enabled) {
        spatialAudio.playAtPosition(x, y, screenWidth, screenHeight, role);
      }
    },
    [enabled]
  );

  return { playAtPosition, isEnabled: enabled };
}
