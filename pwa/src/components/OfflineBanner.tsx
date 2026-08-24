import { useOnlineStatus } from "@/core/hooks/useOnlineStatus";
import { useEffect } from "react";
import { speechEngine } from "@/core/audio/SpeechEngine";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (!isOnline) {
      speechEngine.init();
      speechEngine.interrupt(
        "You are offline. AI Vision and Accessible Reader require internet. Touch Explorer and Voice Navigation still work."
      );
    }
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <div
      className="bg-yellow-900/80 text-yellow-200 text-center px-4 py-2 text-sm"
      role="status"
      aria-live="polite"
    >
      You are offline. Some features require internet.
    </div>
  );
}
