/**
 * VisionAssistantPage — Point camera at anything, AI describes it.
 * Large capture button, description panel, upload alternative, history.
 */

import { useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useVisionAssistant } from "./useVisionAssistant";
import { Button } from "@/components/Button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { IconUpload, IconRefresh, IconCaptureCircle } from "@/components/Icons";
import { PageShell } from "@/components/PageShell";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { useSettingsStore } from "@/core/store/settingsStore";
import { pushTactileHandoff } from "@/modules/tactile-output/inputAdapters";

// Recognize camera-permission errors by their user-facing text.
// useVisionAssistant emits explainCameraError() strings; keep this in sync.
function isPermissionDenied(message: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("permission") && (lower.includes("denied") || lower.includes("blocked"));
}

export default function VisionAssistantPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const announce = useAnnounce();
  const setSetupStatus = useSettingsStore((s) => s.setSetupStatus);

  const {
    state,
    description,
    history,
    error,
    startCamera,
    stopCamera,
    captureAndDescribe,
    describeFromFile,
    repeatDescription,
    clearHistory,
  } = useVisionAssistant();

  useEffect(() => {
    if (videoRef.current) {
      startCamera(videoRef.current);
    }
    announce("AI Vision is ready. Point your camera at something and tap the capture button.");
    speechEngine.speak("AI Vision is ready. Point your camera at something and tap the large capture button at the bottom.");

    return () => stopCamera();
  }, [startCamera, stopCamera, announce]);

  // Stop the camera the moment the tab/page is hidden — battery + privacy.
  // Restart it when the user returns, so the experience is seamless.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") {
        stopCamera();
      } else if (document.visibilityState === "visible" && videoRef.current) {
        startCamera(videoRef.current);
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [startCamera, stopCamera]);

  // Reflect the latest camera attempt into setupStatus so the Settings page
  // and any future module-level UIs see a consistent permission picture.
  useEffect(() => {
    if (isPermissionDenied(error)) {
      setSetupStatus({ camera: "denied" });
    }
  }, [error, setSetupStatus]);

  const retryCamera = useCallback(() => {
    if (videoRef.current) {
      startCamera(videoRef.current);
    }
  }, [startCamera]);

  const openSetup = useCallback(() => {
    stopCamera();
    navigate("/onboarding?restart=1");
  }, [navigate, stopCamera]);

  const copyDescription = useCallback(async () => {
    if (!description) return;
    try {
      await navigator.clipboard.writeText(description);
      announce("Copied to clipboard");
      speechEngine.interrupt("Copied.");
    } catch {
      // Older browsers / blocked clipboard — fall back to a textarea trick
      // so the action still works without ever silently failing.
      const ta = document.createElement("textarea");
      ta.value = description;
      ta.setAttribute("aria-hidden", "true");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        announce("Copied to clipboard");
        speechEngine.interrupt("Copied.");
      } catch {
        announce("Could not copy. Clipboard access is blocked.");
        speechEngine.interrupt("Could not copy. Clipboard access is blocked.");
      }
      document.body.removeChild(ta);
    }
  }, [announce, description]);

  const sendToReader = useCallback(() => {
    if (!description) return;
    stopCamera();
    speechEngine.interrupt("Sending to Reader.");
    navigate("/reader", {
      state: {
        preload: {
          title: "AI Vision description",
          text: description,
          source: "AI Vision",
        },
      },
    });
  }, [description, navigate, stopCamera]);

  const sendToTactile = useCallback(() => {
    if (!description) return;
    pushTactileHandoff(description, "AI Vision");
    speechEngine.interrupt("Sent to Tactile Lab.");
    stopCamera();
    navigate("/tactile-output");
  }, [description, navigate, stopCamera]);

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) describeFromFile(file);
    },
    [describeFromFile]
  );

  const stateLabel = {
    idle: "Ready",
    capturing: "Capturing...",
    analyzing: "Analyzing...",
    speaking: "Speaking...",
  };

  return (
    <PageShell
      title="AI Vision"
      accent="yellow"
      onBack={() => { stopCamera(); navigate("/"); }}
      headerRight={
        <span className="text-sm text-stone-400" role="status">{stateLabel[state]}</span>
      }
      className="flex flex-col"
    >

      {/* Camera feed */}
      <div className="flex-1 relative bg-black">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          aria-hidden="true"
          playsInline
          muted
        />

        {/* Error overlay */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/85 p-6">
            <div className="max-w-sm w-full text-center" role="alert">
              <p className="text-rose-300 text-base sm:text-lg leading-relaxed mb-5">{error}</p>
              {isPermissionDenied(error) ? (
                <div className="space-y-3">
                  <Button onClick={retryCamera} size="lg" className="w-full">
                    Try again
                  </Button>
                  <Button onClick={openSetup} variant="secondary" className="w-full">
                    Run setup again
                  </Button>
                  <p className="text-xs text-stone-400 leading-relaxed mt-3">
                    If the prompt doesn't reappear, allow camera access for this site in your browser settings, then tap Try again.
                  </p>
                </div>
              ) : (
                <Button onClick={retryCamera} size="lg" className="w-full">
                  Try again
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Description panel */}
      {description && (
        <div className="bg-surface-1 border-t border-surface-border px-4 py-4 max-h-56 overflow-y-auto">
          <div className="max-w-lg mx-auto">
            <div className="flex items-start justify-between gap-2 mb-3">
              <p className="text-stone-200 text-base leading-relaxed flex-1">{description}</p>
              <Button
                variant="ghost"
                onClick={repeatDescription}
                aria-label="Repeat description"
                className="flex-shrink-0"
              >
                <IconRefresh className="w-5 h-5" />
              </Button>
            </div>
            {/* Handoff row — Copy / Send to Reader / Send to Tactile / Clear */}
            <div className="flex flex-wrap gap-2" role="group" aria-label="Description actions">
              <button
                onClick={copyDescription}
                className="min-h-touch px-3 py-2 rounded-lg text-sm font-medium bg-surface-2 hover:bg-surface-3 text-stone-100 border border-surface-border focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 transition-colors"
              >
                Copy
              </button>
              <button
                onClick={sendToReader}
                className="min-h-touch px-3 py-2 rounded-lg text-sm font-medium bg-surface-2 hover:bg-surface-3 text-stone-100 border border-surface-border focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 transition-colors"
              >
                Send to Reader
              </button>
              <button
                onClick={sendToTactile}
                className="min-h-touch px-3 py-2 rounded-lg text-sm font-medium bg-surface-2 hover:bg-surface-3 text-stone-100 border border-surface-border focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 transition-colors"
              >
                Send to Tactile
              </button>
              <button
                onClick={clearHistory}
                className="min-h-touch px-3 py-2 rounded-lg text-sm font-medium bg-rose-500/15 hover:bg-rose-500/25 text-rose-200 border border-rose-400/30 focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 ml-auto transition-colors"
                aria-label="Clear vision history"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-surface-0/95 border-t border-surface-border backdrop-blur px-4 py-4">
        <div className="flex items-center justify-center gap-4 max-w-lg mx-auto">
          {/* Upload button */}
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload an image"
          >
            <IconUpload className="w-5 h-5 inline mr-1" /> Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
            aria-hidden="true"
          />

          {/* Capture button — large and prominent */}
          <button
            onClick={() => captureAndDescribe()}
            disabled={state === "analyzing"}
            className={`
              w-20 h-20 rounded-full border-4
              flex items-center justify-center
              text-3xl font-bold transition-colors
              focus-visible:ring-4 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900
              ${
                state === "analyzing"
                  ? "bg-gray-600 border-gray-500 cursor-wait"
                  : "bg-white border-primary-400 hover:bg-primary-100 active:bg-primary-200"
              }
            `}
            aria-label={
              state === "analyzing"
                ? "Analyzing image, please wait"
                : "Capture and describe what you see"
            }
          >
            {state === "analyzing" ? (
              <LoadingSpinner size="sm" label="" />
            ) : (
              <IconCaptureCircle className="w-12 h-12 text-primary-600" />
            )}
          </button>

          {/* Repeat button */}
          <Button
            variant="secondary"
            onClick={repeatDescription}
            disabled={!description}
            aria-label="Repeat last description"
          >
            <IconRefresh className="w-5 h-5 inline mr-1" /> Repeat
          </Button>
        </div>
      </div>

      {/* History */}
      {history.length > 1 && (
        <div className="bg-surface-1 border-t border-surface-border px-4 py-3">
          <details className="max-w-3xl mx-auto">
            <summary className="text-sm text-stone-400 cursor-pointer min-h-touch flex items-center select-none">
              Previous descriptions ({history.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {history.map((entry) => (
                <li key={entry.id}>
                  <button
                    onClick={() => speechEngine.interrupt(entry.description)}
                    className="w-full text-left bg-surface-2 border border-surface-border rounded-xl p-3 text-sm text-stone-300 hover:bg-surface-3 min-h-touch transition-colors"
                    aria-label={`Replay: ${entry.description.slice(0, 50)}...`}
                  >
                    <span className="text-stone-500 text-xs block mb-1">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    {entry.description.slice(0, 150)}
                    {entry.description.length > 150 ? "..." : ""}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </PageShell>
  );
}
