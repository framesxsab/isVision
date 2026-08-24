/**
 * PerfOverlay — Minimal opt-in HUD showing rendered FPS and the number of
 * explorable elements in the touch surface. Toggled from the page header;
 * the rAF loop only runs while visible.
 */

import { useEffect, useRef, useState } from "react";
import { countRegions, totalRegionCount } from "./regionStats";

interface PerfOverlayProps {
  containerRef: React.RefObject<HTMLElement | null>;
  visible: boolean;
}

export function PerfOverlay({ containerRef, visible }: PerfOverlayProps) {
  const [fps, setFps] = useState(0);
  const [elementCount, setElementCount] = useState(0);
  const framesRef = useRef(0);

  useEffect(() => {
    if (!visible) return;

    const root = containerRef.current;
    if (root) setElementCount(totalRegionCount(countRegions(root)));

    let raf = 0;
    let lastTick = performance.now();
    const loop = (now: number) => {
      framesRef.current += 1;
      if (now - lastTick >= 1000) {
        setFps(framesRef.current);
        framesRef.current = 0;
        lastTick = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [visible, containerRef]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed bottom-3 right-3 z-40 rounded-lg border border-surface-border bg-surface-0/90 backdrop-blur px-3 py-1.5 font-mono text-xs text-stone-400 pointer-events-none"
    >
      {fps} fps · {elementCount} regions
    </div>
  );
}
