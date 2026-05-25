/**
 * ElementHighlight — Visual overlay that outlines the currently
 * touched element. Helps sighted helpers see what the blind user
 * is currently exploring.
 */

import { useEffect, useState } from "react";

interface HighlightProps {
  element: Element | null;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function ElementHighlight({ element }: HighlightProps) {
  const [rect, setRect] = useState<HighlightRect | null>(null);

  useEffect(() => {
    if (!element) {
      setRect(null);
      return;
    }

    const bounds = element.getBoundingClientRect();
    setRect({
      top: bounds.top,
      left: bounds.left,
      width: bounds.width,
      height: bounds.height,
    });
  }, [element]);

  if (!rect) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-50 border-2 border-primary-400 bg-primary-400/10 rounded transition-all duration-75"
      style={{
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      }}
    />
  );
}
