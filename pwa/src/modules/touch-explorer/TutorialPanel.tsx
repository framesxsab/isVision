/**
 * TutorialPanel — Collapsible first-run tutorial for the Touch Explorer.
 * Opens automatically on the first visit, stays dismissible forever, and
 * remembers the dismissed state in localStorage. Rendered as a native
 * <details> element below the exploration area so it never intercepts
 * touches or hovers meant for the surface above it.
 */

import { useEffect, useRef, useState } from "react";
import { sectionCard } from "@/components/PageShell";

const STORAGE_KEY = "isvisible-touch-tutorial-dismissed";

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function writeDismissed(dismissed: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(dismissed));
  } catch {
    // Private mode — tutorial just reopens next visit.
  }
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0";

export function TutorialPanel() {
  const [dismissed, setDismissed] = useState(true);
  const hydratedRef = useRef(false);

  useEffect(() => {
    setDismissed(readDismissed());
    hydratedRef.current = true;
  }, []);

  const toggle = (open: boolean) => {
    setDismissed(!open);
    if (hydratedRef.current) writeDismissed(!open);
  };

  return (
    <section
      aria-label="Tutorial"
      className={`${sectionCard} mt-4 ${dismissed ? "" : "border-primary-400/30"}`}
    >
      <details
        open={!dismissed}
        onToggle={(e) => toggle((e.target as HTMLDetailsElement).open)}
      >
        <summary
          className={`min-h-touch flex items-center justify-between cursor-pointer list-none rounded-lg px-2 py-2 -mx-2 text-sm font-semibold uppercase tracking-[0.18em] text-stone-400 hover:text-stone-200 transition-colors ${focusRing}`}
        >
          How to use Touch Explorer
          <span aria-hidden="true" className="text-stone-400">
            {dismissed ? "Show" : "Hide"}
          </span>
        </summary>

        <div className="mt-3 space-y-3 text-stone-300 text-sm leading-relaxed">
          <p>
            <strong className="text-stone-100">Touch:</strong> slide one finger
            slowly across the screen. Every element you cross is spoken aloud,
            vibrates with its own pattern, and plays a tone panned to where it
            sits on screen.
          </p>
          <p>
            <strong className="text-stone-100">Keyboard:</strong> Tab to the
            exploration area, then use the arrow keys to move a virtual cursor.
            Enter or Space repeats the current element. Escape returns home.
          </p>
          <p>
            <strong className="text-stone-100">Legend:</strong> the region
            legend below counts headings, links, buttons, and images. Activate
            a row to hear how many of each are on the page.
          </p>
          <p>
            <strong className="text-stone-100">Calibration:</strong> use the
            calibration panel to test left / center / right audio cues and feel
            your current haptic intensity before you start exploring.
          </p>
        </div>

        <button
          type="button"
          onClick={() => toggle(true)}
          className={`mt-4 min-h-touch rounded-xl border border-surface-border bg-surface-2 px-4 py-2 text-sm font-semibold text-stone-200 hover:bg-surface-3 transition-colors ${focusRing}`}
        >
          Got it — dismiss tutorial
        </button>
      </details>
    </section>
  );
}
