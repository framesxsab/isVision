/**
 * useTouchExplorer — Core hook that powers the touch exploration experience.
 *
 * Flow: touchmove → getElementAt → describeElement → interrupt speech
 *       → vibrate → spatial audio
 *
 * Throttled to ~100ms to avoid overwhelming the speech engine.
 * Deduplicates: only speaks when the element changes.
 */

import { useCallback, useRef } from "react";
import { getElementAt, getElementRole, getElementBounds } from "@/core/utils/domInspector";
import { describeElement } from "@/core/utils/elementDescriber";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { hapticEngine } from "@/core/haptics/HapticEngine";
import { spatialAudio } from "@/core/audio/SpatialAudio";
import { useSettingsStore } from "@/core/store/settingsStore";

const THROTTLE_MS = 100;

export interface TouchExplorerState {
  currentElement: Element | null;
  currentDescription: string;
}

export function useTouchExplorer(
  /** Reference to the touch surface container — events outside it are ignored */
  containerRef: React.RefObject<HTMLElement | null>,
  /** Called whenever the explored element changes — avoids polling. */
  onElementChange?: (state: TouchExplorerState) => void
) {
  const lastElementRef = useRef<Element | null>(null);
  const lastFireRef = useRef(0);
  const stateRef = useRef<TouchExplorerState>({
    currentElement: null,
    currentDescription: "",
  });

  const hapticEnabled = useSettingsStore((s) => s.hapticEnabled);
  const spatialEnabled = useSettingsStore((s) => s.spatialAudioEnabled);

  const handleTouch = useCallback(
    (x: number, y: number) => {
      // Throttle
      const now = Date.now();
      if (now - lastFireRef.current < THROTTLE_MS) return;
      lastFireRef.current = now;

      const el = getElementAt(x, y);
      if (!el) return;

      // Skip the container itself and the body/html
      if (
        el === containerRef.current ||
        el === document.body ||
        el === document.documentElement
      ) {
        return;
      }

      // Deduplicate: don't repeat the same element
      if (el === lastElementRef.current) return;
      lastElementRef.current = el;

      // Generate description and speak it
      const description = describeElement(el);
      stateRef.current = { currentElement: el, currentDescription: description };
      onElementChange?.(stateRef.current);

      // 1. Interrupt speech with new description
      speechEngine.interrupt(description);

      // 2. Haptic feedback based on role
      if (hapticEnabled) {
        const role = getElementRole(el);
        hapticEngine.vibrateForRole(role);
      }

      // 3. Spatial audio cue based on position
      if (spatialEnabled) {
        const bounds = getElementBounds(el);
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        const role = getElementRole(el);

        spatialAudio.playAtPosition(
          centerX,
          centerY,
          window.innerWidth,
          window.innerHeight,
          role
        );
      }
    },
    [containerRef, hapticEnabled, spatialEnabled, onElementChange]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // Prevent default to ensure touchmove fires on iOS
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) handleTouch(touch.clientX, touch.clientY);
    },
    [handleTouch]
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) handleTouch(touch.clientX, touch.clientY);
    },
    [handleTouch]
  );

  const onTouchEnd = useCallback(() => {
    lastElementRef.current = null;
  }, []);

  // Mouse support for desktop testing
  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleTouch(e.clientX, e.clientY);
    },
    [handleTouch]
  );

  return {
    touchHandlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onMouseMove,
    },
  };
}
