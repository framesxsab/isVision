import { useEffect } from "react";
import { useSettingsStore } from "@/core/store/settingsStore";

/**
 * Syncs the high-contrast setting with the OS prefers-color-scheme.
 * Only auto-enables on first visit (before user manually changes it).
 */
export function useDarkModeSync() {
  const setHighContrast = useSettingsStore((s) => s.setHighContrast);

  useEffect(() => {
    // Only sync if the user hasn't manually set a preference yet
    const stored = localStorage.getItem("isvisible-settings");
    if (stored) {
      const parsed = JSON.parse(stored) as { state?: { highContrast?: boolean } };
      // If user has explicitly set highContrast, don't override
      if (parsed.state && typeof parsed.state.highContrast === "boolean") return;
    }

    const mq = window.matchMedia("(prefers-contrast: more)");
    if (mq.matches) {
      setHighContrast(true);
    }

    function handleChange(e: MediaQueryListEvent) {
      if (e.matches) setHighContrast(true);
    }

    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, [setHighContrast]);
}
