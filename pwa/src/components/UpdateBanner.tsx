import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { speechEngine } from "@/core/audio/SpeechEngine";

// Shown at the top of the app when the service worker has a newer build
// ready. Replaces VitePWA's previous registerType: "autoUpdate", which
// silently reloaded the page — disorienting for a blind user mid-camera
// capture or mid-article. With "prompt" the new SW waits for the user to
// confirm, and we announce the availability without interrupting active
// speech.
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn("Service worker registration failed", error);
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    // speak() queues; interrupt() would clobber any ongoing TTS (e.g. a
    // Reader chunk being read aloud). Queueing is the polite choice here.
    speechEngine.speak(
      "A new version of isVisible is available. Tap update when you are ready, or dismiss to keep reading."
    );
  }, [needRefresh]);

  if (!needRefresh) return null;

  const apply = () => {
    speechEngine.interrupt("Updating now.");
    updateServiceWorker(true);
  };

  const dismiss = () => {
    setNeedRefresh(false);
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-primary-900/90 border-b border-primary-700 px-4 py-2 flex items-center justify-between gap-3"
    >
      <p className="text-primary-100 text-sm">
        A new version is available.
      </p>
      <div className="flex gap-2">
        <button
          onClick={apply}
          className="min-h-touch px-3 py-1 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          Update
        </button>
        <button
          onClick={dismiss}
          className="min-h-touch px-3 py-1 rounded-lg bg-transparent text-primary-200 hover:bg-primary-800 text-sm focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          Later
        </button>
      </div>
    </div>
  );
}
