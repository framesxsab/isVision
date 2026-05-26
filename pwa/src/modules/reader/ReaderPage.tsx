/**
 * ReaderPage — Paste a URL, read it accessibly.
 * URL input at top, article content in center, reading controls at bottom.
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useReader } from "./useReader";
import { Button } from "@/components/Button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { IconArrowLeft, IconPlay, IconPause, IconSkipForward, IconSkipBack } from "@/components/Icons";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useSettingsStore } from "@/core/store/settingsStore";
import { useAnnounce } from "@/core/a11y/AriaLive";

export default function ReaderPage() {
  const navigate = useNavigate();
  const [urlInput, setUrlInput] = useState("");
  const announce = useAnnounce();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const highContrast = useSettingsStore((s) => s.highContrast);
  const speechRate = useSettingsStore((s) => s.speechRate);
  const setSpeechRate = useSettingsStore((s) => s.setSpeechRate);
  const speechRateRef = useRef(speechRate);
  speechRateRef.current = speechRate;

  const {
    title,
    htmlContent,
    headings,
    chunks,
    currentChunk,
    isReading,
    isPaused,
    isLoading,
    error,
    loadUrl,
    togglePlayPause,
    nextChunk,
    prevChunk,
    jumpToHeading,
  } = useReader();

  useEffect(() => {
    announce("Accessible Reader is ready. Enter a URL to read.");
    speechEngine.speak("Accessible Reader. Enter a URL and tap load to read any webpage.");

    // Keyboard shortcuts
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;

      switch (e.code) {
        case "Space":
          e.preventDefault();
          togglePlayPause();
          break;
        case "ArrowRight":
          e.preventDefault();
          nextChunk();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prevChunk();
          break;
        case "ArrowUp": {
          e.preventDefault();
          const newUp = Math.min(3, speechRateRef.current + 0.2);
          setSpeechRate(newUp);
          speechEngine.setRate(newUp);
          announce(`Speed ${newUp.toFixed(1)}x`);
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const newDown = Math.max(0.5, speechRateRef.current - 0.2);
          setSpeechRate(newDown);
          speechEngine.setRate(newDown);
          announce(`Speed ${newDown.toFixed(1)}x`);
          break;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [announce, togglePlayPause, nextChunk, prevChunk, setSpeechRate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      let url = urlInput.trim();
      if (!url.startsWith("http")) url = `https://${url}`;
      loadUrl(url);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Toolbar */}
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button variant="ghost" onClick={() => navigate("/")} aria-label="Go back to home">
            <IconArrowLeft className="w-5 h-5 inline mr-1" /> Back
          </Button>
          <h1 className="text-lg font-bold text-white">Reader</h1>
          <div className="w-20" />
        </div>
      </header>

      {/* URL Input */}
      <form onSubmit={handleSubmit} className="px-4 py-4 border-b border-gray-800">
        <div className="flex gap-2 max-w-lg mx-auto">
          <label htmlFor="url-input" className="sr-only">
            Enter a URL to read
          </label>
          <input
            id="url-input"
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Paste a URL here..."
            className="flex-1 bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3 min-h-touch"
            aria-label="URL to read"
            aria-describedby="url-hint"
            autoFocus
          />
          <span id="url-hint" className="sr-only">Paste a webpage URL to read it accessibly</span>
          <Button type="submit" disabled={isLoading || !urlInput.trim()}>
            {isLoading ? "Loading..." : "Load"}
          </Button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-900/30 border-b border-red-800" role="alert">
          <p className="text-red-300 max-w-lg mx-auto">{error}</p>
        </div>
      )}

      {/* Article content */}
      <div className="flex-1 px-4 py-6 overflow-y-auto">
        <div className="max-w-lg mx-auto">
          {title && (
            <h2 className="text-2xl font-bold text-white mb-4">{title}</h2>
          )}

          {/* Table of contents */}
          {headings.length > 0 && (
            <details className="mb-6 bg-gray-900 rounded-xl p-4 border border-gray-700">
              <summary className="text-primary-400 font-semibold cursor-pointer min-h-touch flex items-center">
                Table of Contents ({headings.length} headings)
              </summary>
              <nav aria-label="Table of contents" className="mt-3">
                <ul className="space-y-1">
                  {headings.map((h, i) => (
                    <li key={h.id} style={{ paddingLeft: `${(h.level - 1) * 16}px` }}>
                      <button
                        onClick={() => jumpToHeading(i)}
                        className="text-left text-gray-300 hover:text-primary-400 py-1 min-h-touch flex items-center w-full"
                      >
                        {h.text}
                      </button>
                    </li>
                  ))}
                </ul>
              </nav>
            </details>
          )}

          {/* Article body */}
          {isLoading && (
            <div className="flex justify-center py-20">
              <LoadingSpinner label="Loading article..." size="lg" />
            </div>
          )}

          {htmlContent ? (
            <article
              className={`prose prose-invert max-w-none leading-relaxed ${
                highContrast ? "text-white" : "text-gray-200"
              }`}
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              role="article"
            />
          ) : (
            !isLoading && !error && (
              <div className="text-center text-gray-500 py-20">
                <p className="text-xl mb-2">Enter a URL above to start reading</p>
                <p className="text-sm">
                  Keyboard: Space = play/pause, ←→ = navigate, ↑↓ = speed
                </p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Reading controls - fixed at bottom */}
      {chunks.length > 0 && (
        <div className="sticky bottom-16 bg-gray-900/95 backdrop-blur border-t border-gray-700 px-4 py-3">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            {/* Previous */}
            <Button
              variant="ghost"
              onClick={prevChunk}
              disabled={currentChunk === 0}
              aria-label="Previous paragraph"
            >
              <IconSkipBack className="w-6 h-6" />
            </Button>

            {/* Play/Pause */}
            <Button
              onClick={togglePlayPause}
              size="lg"
              aria-label={isReading ? "Pause reading" : isPaused ? "Resume reading" : "Start reading"}
            >
              {isReading ? (
                <><IconPause className="w-5 h-5 inline mr-1" /> Pause</>
              ) : (
                <><IconPlay className="w-5 h-5 inline mr-1" /> Play</>
              )}
            </Button>

            {/* Next */}
            <Button
              variant="ghost"
              onClick={nextChunk}
              disabled={currentChunk >= chunks.length - 1}
              aria-label="Next paragraph"
            >
              <IconSkipForward className="w-6 h-6" />
            </Button>
          </div>

          {/* Progress */}
          <div className="max-w-lg mx-auto mt-2">
            <div className="flex justify-between text-xs text-gray-500">
              <span>
                {currentChunk + 1} / {chunks.length}
              </span>
              <span>{speechRate.toFixed(1)}x speed</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
              <div
                className="bg-primary-500 h-1.5 rounded-full transition-all"
                style={{
                  width: `${((currentChunk + 1) / chunks.length) * 100}%`,
                }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={chunks.length}
                aria-valuenow={currentChunk + 1}
                aria-label={`Reading progress: ${currentChunk + 1} of ${chunks.length} sections`}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
