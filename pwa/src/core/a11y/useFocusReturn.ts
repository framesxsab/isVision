import { useRef, useCallback } from "react";

export function useFocusReturn() {
  const triggerRef = useRef<HTMLElement | null>(null);

  const save = useCallback(() => {
    triggerRef.current = document.activeElement as HTMLElement | null;
  }, []);

  const restore = useCallback(() => {
    const el = triggerRef.current;
    if (el && typeof el.focus === "function") {
      requestAnimationFrame(() => el.focus());
    }
  }, []);

  return { save, restore };
}
