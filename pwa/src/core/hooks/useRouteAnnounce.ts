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
  }, [location.pathname, announce]);
}
