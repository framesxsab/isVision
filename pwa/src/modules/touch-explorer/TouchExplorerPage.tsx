/**
 * TouchExplorerPage — The main page for touch exploration.
 * Users slide their finger across the screen to hear descriptions
 * of elements with haptic and spatial audio feedback.
 */

import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTouchExplorer } from "./useTouchExplorer";
import { TouchSurface } from "./TouchSurface";
import { ElementHighlight } from "./ElementHighlight";
import { Button } from "@/components/Button";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useAnnounce } from "@/core/a11y/AriaLive";

export default function TouchExplorerPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { touchHandlers, getState } = useTouchExplorer(containerRef);
  const [highlightElement, setHighlightElement] = useState<Element | null>(null);
  const [lastDescription, setLastDescription] = useState("");
  const navigate = useNavigate();
  const announce = useAnnounce();

  // Poll for state changes to update the highlight (refs don't trigger re-render)
  useEffect(() => {
    const interval = setInterval(() => {
      const state = getState();
      if (state.currentElement !== highlightElement) {
        setHighlightElement(state.currentElement);
        setLastDescription(state.currentDescription);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [getState, highlightElement]);

  useEffect(() => {
    announce("Touch Explorer is ready. Slide your finger across the screen to explore elements.");
    speechEngine.speak(
      "Touch Explorer is ready. Slide your finger across the screen to explore elements. Each element will be spoken with haptic feedback."
    );
  }, [announce]);

  return (
    <div className="min-h-screen">
      {/* Toolbar */}
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button variant="ghost" onClick={() => navigate("/")} aria-label="Go back to home">
            ← Back
          </Button>
          <h1 className="text-lg font-bold text-white">Touch Explorer</h1>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Status bar showing current element */}
      {lastDescription && (
        <div
          className="sticky top-16 z-20 bg-primary-900/90 backdrop-blur px-4 py-2 text-center"
          role="status"
          aria-live="polite"
        >
          <p className="text-primary-200 text-sm font-medium truncate">
            {lastDescription}
          </p>
        </div>
      )}

      {/* Touch exploration area */}
      <div
        ref={containerRef}
        {...touchHandlers}
        className="touch-none cursor-crosshair"
        role="application"
        aria-label="Touch exploration area. Slide your finger to explore elements."
        aria-roledescription="touch explorer"
      >
        <TouchSurface />
      </div>

      {/* Highlight overlay */}
      <ElementHighlight element={highlightElement} />
    </div>
  );
}
