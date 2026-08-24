// Preview zoom for the Tactile Lab braille preview: 1x / 1.5x / 2x.
//
// Zoom is a pure CSS transform scale on the glyph paragraph. Transforms don't
// affect layout, so ScaledPreview measures the scaled bounding box and reserves
// that height — otherwise 1.5x/2x content would overlap the stat cards below.
// No transitions are used, so the global prefers-reduced-motion kill-switch in
// index.css has nothing to tone down; the scale change is instant.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { toggleActive, toggleInactive } from "@/components/PageShell";
import { useAnnounce } from "@/core/a11y/AriaLive";

export const ZOOM_LEVELS = [1, 1.5, 2] as const;
export type ZoomLevel = (typeof ZOOM_LEVELS)[number];

const focusRing =
  "focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0";

interface ZoomControlsProps {
  value: ZoomLevel;
  onChange: (next: ZoomLevel) => void;
}

export function ZoomControls({ value, onChange }: ZoomControlsProps) {
  const announce = useAnnounce();

  return (
    <div role="group" aria-label="Preview zoom" className="flex items-center gap-1">
      {ZOOM_LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => {
            if (level === value) return;
            onChange(level);
            announce(`Preview zoom ${level}x.`);
          }}
          aria-pressed={value === level}
          aria-label={`Zoom preview to ${level} times`}
          className={`min-h-touch px-2 rounded-lg border text-sm font-semibold ${focusRing} ${
            value === level ? toggleActive : toggleInactive
          }`}
        >
          {level}x
        </button>
      ))}
    </div>
  );
}

interface ScaledPreviewProps {
  zoom: ZoomLevel;
  children: ReactNode;
}

export function ScaledPreview({ zoom, children }: ScaledPreviewProps) {
  const innerRef = useRef<HTMLDivElement | null>(null);
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);

  // Re-measure when zoom flips (transform changes don't fire ResizeObserver)
  // and let the observer catch text-wrap/viewport-driven layout changes.
  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setScaledHeight(el.getBoundingClientRect().height);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [zoom]);

  return (
    <div
      data-testid="scaled-preview"
      className="overflow-hidden"
      style={scaledHeight !== null ? { height: scaledHeight } : undefined}
    >
      <div
        ref={innerRef}
        style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
      >
        {children}
      </div>
    </div>
  );
}
