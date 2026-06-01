/**
 * TouchExplorerPage — The main page for touch exploration.
 * Users slide their finger across the screen to hear descriptions
 * of elements with haptic and spatial audio feedback.
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTouchExplorer } from "./useTouchExplorer";
import type { TouchExplorerState } from "./useTouchExplorer";
import { TouchSurface } from "./TouchSurface";
import { ElementHighlight } from "./ElementHighlight";
import { PageShell } from "@/components/PageShell";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useAnnounce } from "@/core/a11y/AriaLive";

export default function TouchExplorerPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightElement, setHighlightElement] = useState<Element | null>(null);
  const [lastDescription, setLastDescription] = useState("");
  const announce = useAnnounce();
  const navigate = useNavigate();

  const handleElementChange = useCallback((state: TouchExplorerState) => {
    setHighlightElement(state.currentElement);
    setLastDescription(state.currentDescription);
  }, []);

  const { touchHandlers } = useTouchExplorer(containerRef, handleElementChange);

  useEffect(() => {
    announce("Touch Explorer is ready. Slide your finger across the screen to explore elements.");
    speechEngine.speak(
      "Touch Explorer is ready. Slide your finger across the screen to explore elements. Each element will be spoken with haptic feedback."
    );
  }, [announce]);

  return (
    <PageShell title="Touch Explorer" accent="orange" className="flex flex-col">
      {/* Status bar showing current element */}
      {lastDescription && (
        <div
          className="sticky top-[53px] z-20 bg-primary-500/15 border-b border-primary-400/20 backdrop-blur px-4 py-2 text-center"
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
        aria-label="Touch exploration area. Slide your finger to explore elements. Press Escape to leave."
        aria-roledescription="touch explorer"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === "Escape") navigate("/"); }}
      >
        <TouchSurface />
      </div>

      {/* Highlight overlay */}
      <ElementHighlight element={highlightElement} />
    </PageShell>
  );
}
