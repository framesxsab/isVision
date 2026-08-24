import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

interface FocusTrapProps {
  children: ReactNode;
  active?: boolean;
}

export function FocusTrap({ children, active = true }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !containerRef.current) return;

    const trigger = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;

      const focusable = container.querySelectorAll<HTMLElement>(focusableSelector);
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    container.addEventListener("keydown", handleKeyDown);

    // Focus the first focusable element
    const firstFocusable = container.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the element that opened the dialog
      if (trigger && typeof trigger.focus === "function") {
        // rAF avoids focus race with React unmount
        requestAnimationFrame(() => trigger.focus());
      }
    };
  }, [active]);

  return (
    <div ref={containerRef} role="dialog" aria-modal={active}>
      {children}
    </div>
  );
}
