import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAnnounce } from "@/core/a11y/AriaLive";

const routeTitles: Record<string, string> = {
  "/": "Home",
  "/settings": "Settings",
  "/onboarding": "Welcome",
  "/touch-explorer": "Touch Explorer",
  "/ai-vision": "AI Vision",
  "/reader": "Accessible Reader",
  "/voice-nav": "Voice Navigation",
  "/tactile-output": "Tactile Lab",
  "/tactile-drill": "Tactile Drill",
};

/**
 * Announces the page title to screen readers on every route change.
 * Also updates document.title for browser tab.
 */
export function useRouteAnnounce() {
  const location = useLocation();
  const announce = useAnnounce();
  const isFirstRender = useRef(true);

  useEffect(() => {
    const title = routeTitles[location.pathname] ?? "Page";
    document.title = `${title} — isVisible`;

    // Don't announce on initial page load (screen reader reads the page itself)
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    announce(`Navigated to ${title}`, "assertive");

    // Move focus to the new page's h1 so screen-reader and keyboard users land
    // at the page title instead of staying on the link they activated (which
    // may no longer exist after the route change). Routes are lazy-loaded
    // behind Suspense, so the h1 may not be in the DOM on the first frame —
    // poll for up to ~500ms before giving up.
    let cancelled = false;
    let attempts = 0;
    const tryFocus = () => {
      if (cancelled) return;
      const heading = document.querySelector<HTMLElement>("#main-content h1");
      if (heading) {
        if (!heading.hasAttribute("tabindex")) {
          heading.setAttribute("tabindex", "-1");
        }
        heading.focus({ preventScroll: false });
        return;
      }
      if (attempts++ < 30) {
        requestAnimationFrame(tryFocus);
      }
    };
    requestAnimationFrame(tryFocus);
    return () => {
      cancelled = true;
    };
  }, [location.pathname, announce]);
}
