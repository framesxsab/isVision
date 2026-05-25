/**
 * VisionAssistantPage — Point camera at anything, AI describes it.
 * Large capture button, description panel, upload alternative, history.
 */

import { useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useVisionAssistant } from "./useVisionAssistant";
import { Button } from "@/components/Button";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useAnnounce } from "@/core/a11y/AriaLive";

export default function VisionAssistantPage() {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const announce = useAnnounce();

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
  } = useVisionAssistant();

  useEffect(() => {
    if (videoRef.current) {
      startCamera(videoRef.current);
    }
    announce("AI Vision is ready. Point your camera at something and tap the capture button.");
    speechEngine.speak("AI Vision is ready. Point your camera at something and tap the large capture button at the bottom.");

    return () => stopCamera();
  }, [startCamera, stopCamera, announce]);

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
    <div className="min-h-screen flex flex-col">
      {/* Toolbar */}
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button variant="ghost" onClick={() => { stopCamera(); navigate("/"); }} aria-label="Go back to home">
            ← Back
          </Button>
          <h1 className="text-lg font-bold text-white">AI Vision</h1>
          <span className="text-sm text-gray-400 w-20 text-right" role="status">
            {stateLabel[state]}
          </span>
        </div>
      </header>

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
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
            <p className="text-red-400 text-lg text-center" role="alert">{error}</p>
          </div>
        )}
      </div>

      {/* Description panel */}
      {description && (
        <div className="bg-gray-900 border-t border-gray-700 px-4 py-4 max-h-48 overflow-y-auto">
          <div className="flex items-start justify-between gap-2 max-w-lg mx-auto">
            <p className="text-gray-200 text-base leading-relaxed flex-1">{description}</p>
            <Button
              variant="ghost"
              onClick={repeatDescription}
              aria-label="Repeat description"
              className="flex-shrink-0"
            >
              🔁
            </Button>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="bg-gray-900 border-t border-gray-700 px-4 py-4">
        <div className="flex items-center justify-center gap-4 max-w-lg mx-auto">
          {/* Upload button */}
          <Button
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Upload an image"
          >
            📁 Upload
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
            {state === "analyzing" ? "⏳" : "📸"}
          </button>

          {/* Repeat button */}
          <Button
            variant="secondary"
            onClick={repeatDescription}
            disabled={!description}
            aria-label="Repeat last description"
          >
            🔄 Repeat
          </Button>
        </div>
      </div>

      {/* History */}
      {history.length > 1 && (
        <div className="bg-gray-950 border-t border-gray-800 px-4 py-3">
          <details className="max-w-lg mx-auto">
            <summary className="text-sm text-gray-400 cursor-pointer min-h-touch flex items-center">
              Previous descriptions ({history.length})
            </summary>
            <ul className="mt-2 space-y-2">
              {history.map((entry) => (
                <li key={entry.id}>
                  <button
                    onClick={() => speechEngine.interrupt(entry.description)}
                    className="w-full text-left bg-gray-900 rounded-lg p-3 text-sm text-gray-300 hover:bg-gray-800 min-h-touch"
                    aria-label={`Replay: ${entry.description.slice(0, 50)}...`}
                  >
                    <span className="text-gray-500 text-xs block mb-1">
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
    </div>
  );
}
