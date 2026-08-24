/**
 * TouchExplorerPage — The main page for touch exploration.
 * Users slide their finger across the screen to hear descriptions
 * of elements with haptic and spatial audio feedback. Keyboard users
 * get the same experience: Tab focuses the region, arrow keys move a
 * virtual exploration cursor, Enter/Space repeats the current element,
 * and Escape returns home.
 */

import { useRef, useState, useEffect, useCallback, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useTouchExplorer } from "./useTouchExplorer";
import type { TouchExplorerState } from "./useTouchExplorer";
import { TouchSurface } from "./TouchSurface";
import { ElementHighlight } from "./ElementHighlight";
import { RegionLegend } from "./RegionLegend";
import { CalibrationPanel } from "./CalibrationPanel";
import { TutorialPanel } from "./TutorialPanel";
import { HapticIntensityControl } from "./HapticIntensityControl";
import { PerfOverlay } from "./PerfOverlay";
import { PageShell, sectionCard } from "@/components/PageShell";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { describeElement } from "@/core/utils/elementDescriber";

/** How far each arrow-key press moves the virtual exploration cursor */
const CURSOR_STEP_PX = 48;

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select"));
}

export default function TouchExplorerPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [highlightElement, setHighlightElement] = useState<Element | null>(null);
  const [lastDescription, setLastDescription] = useState("");
  const [perfVisible, setPerfVisible] = useState(false);
  const announce = useAnnounce();
  const navigate = useNavigate();

  // Virtual exploration cursor for keyboard users (viewport coordinates)
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  const lastExploredRef = useRef<Element | null>(null);

  const handleElementChange = useCallback((state: TouchExplorerState) => {
    setHighlightElement(state.currentElement);
    setLastDescription(state.currentDescription);
  }, []);

  const { touchHandlers } = useTouchExplorer(containerRef, handleElementChange);

  /** Describe and announce whatever sits at a viewport point — the keyboard twin of the hook's handleTouch */
  const exploreAtPoint = useCallback(
    (x: number, y: number) => {
      const el = document.elementFromPoint(x, y);
      if (
        !el ||
        el === containerRef.current ||
        el === document.body ||
        el === document.documentElement
      ) {
        return;
      }

      // Deduplicate: don't repeat while the cursor stays on the same element
      if (el === lastExploredRef.current) return;
      lastExploredRef.current = el;

      const description = describeElement(el);
      setHighlightElement(el);
      setLastDescription(description);
      announce(description);
      speechEngine.speak(description);
    },
    [announce]
  );

  useEffect(() => {
    announce("Touch Explorer is ready. Slide your finger across the screen to explore elements.");
    speechEngine.speak(
      "Touch Explorer is ready. Slide your finger across the screen to explore elements, or press Tab and use the arrow keys."
    );
  }, [announce]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      // Escape always leaves the explorer
      if (e.key === "Escape") {
        navigate("/");
        return;
      }

      // Custom keys only apply when the region itself has focus — never
      // hijack keys from the sample buttons, links, or form fields inside it.
      if (e.target !== e.currentTarget || isTypingTarget(e.target)) return;

      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();

      switch (e.key) {
        case "ArrowUp":
        case "ArrowDown":
        case "ArrowLeft":
        case "ArrowRight": {
          e.preventDefault();
          // Start the virtual cursor at the center of the region on first use
          const pos =
            cursorRef.current ?? {
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            };
          const x = Math.min(
            Math.max(
              pos.x +
                (e.key === "ArrowRight" ? CURSOR_STEP_PX : e.key === "ArrowLeft" ? -CURSOR_STEP_PX : 0),
              rect.left
            ),
            rect.right - 1
          );
          const y = Math.min(
            Math.max(
              pos.y +
                (e.key === "ArrowDown" ? CURSOR_STEP_PX : e.key === "ArrowUp" ? -CURSOR_STEP_PX : 0),
              rect.top
            ),
            rect.bottom - 1
          );
          cursorRef.current = { x, y };
          exploreAtPoint(x, y);
          break;
        }
        case "Enter":
        case " ": {
          e.preventDefault();
          const message =
            lastDescription ||
            "No element explored yet. Use the arrow keys to move onto an element.";
          announce(message);
          speechEngine.speak(message);
          break;
        }
      }
    },
    [announce, exploreAtPoint, lastDescription, navigate]
  );

  return (
    <PageShell
      title="Touch Explorer"
      accent="orange"
      className="flex flex-col"
      headerRight={
        <button
          type="button"
          aria-pressed={perfVisible}
          aria-label={perfVisible ? "Hide performance overlay" : "Show performance overlay"}
          onClick={() => setPerfVisible((v) => !v)}
          className="
            min-h-touch min-w-touch rounded-lg px-2
            text-[11px] font-mono font-semibold tracking-tight
            text-stone-400 hover:text-stone-100 transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0
          "
        >
          FPS
        </button>
      }
    >
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

      {/* Keyboard instructions referenced by the exploration area below */}
      <p id="touch-explorer-keyboard-help" className="sr-only">
        Keyboard exploration: use the arrow keys to move the exploration cursor.
        Each element you land on is announced automatically. Press Enter or Space
        to repeat the current element description. Press Escape to return home.
      </p>

      {/* Touch exploration area */}
      <div
        ref={containerRef}
        {...touchHandlers}
        className="touch-none cursor-crosshair focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
        role="region"
        aria-label="Touch exploration area. Slide your finger or use arrow keys to explore. Press Enter to hear the current element. Press Escape to leave."
        aria-describedby="touch-explorer-keyboard-help"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <TouchSurface />
      </div>

      {/* Highlight overlay */}
      <ElementHighlight element={highlightElement} />

      {/* ── Phase 3 flagship additions (all below the exploration area,
             so nothing intercepts touches or hovers on the surface) ── */}

      <div className="px-4 pb-8 max-w-3xl w-full mx-auto">
        <section aria-label="Feedback settings" className={`${sectionCard} mt-4`}>
          <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400 mb-3">
            Feedback settings
          </h2>
          <p className="text-stone-400 text-sm mb-3">
            Choose how strong vibrations feel when you explore.
          </p>
          <HapticIntensityControl />
        </section>

        <RegionLegend containerRef={containerRef} />

        <CalibrationPanel />

        <TutorialPanel />
      </div>

      <PerfOverlay containerRef={containerRef} visible={perfVisible} />
    </PageShell>
  );
}
