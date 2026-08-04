/**
 * ReaderPage — Paste a URL, read it accessibly.
 * URL input at top, article content in center, reading controls at bottom.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useReader } from "./useReader";
import { Button } from "@/components/Button";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import {
  IconArrowLeft,
  IconBraille,
  IconPlay,
  IconPause,
  IconSkipForward,
  IconSkipBack,
  IconRefresh,
} from "@/components/Icons";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useSettingsStore } from "@/core/store/settingsStore";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { pushTactileHandoff } from "@/modules/tactile-output/inputAdapters";
import {
  changeReaderSpeed,
  MODULE_VOICE_ACTION_EVENT,
  takePendingVoiceAction,
  type VoiceAction,
} from "@/modules/voice-nav/voiceActions";

interface PreloadState {
  preload?: { title: string; text: string; source: string };
  resume?: { url: string; chunkIndex: number };
}

function isInteractiveShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(
    target.closest(
      'input, textarea, select, button, a, summary, [role="button"], [role="link"], [role="radio"], [role="checkbox"], [role="tab"], [role="menuitem"]'
    )
  );
}

export default function ReaderPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [urlInput, setUrlInput] = useState("");
  const articleRef = useRef<HTMLElement | null>(null);
  // Text the user has highlighted inside the article. Empty when no
  // selection or the selection sits outside the article body. Drives the
  // visibility of the "Send selection to Tactile Lab" handoff.
  const [selectedText, setSelectedText] = useState("");
  const announce = useAnnounce();
  const fontSize = useSettingsStore((s) => s.fontSize);
  const highContrast = useSettingsStore((s) => s.highContrast);
  const speechRate = useSettingsStore((s) => s.speechRate);
  const setSpeechRate = useSettingsStore((s) => s.setSpeechRate);
  const speechRateRef = useRef(speechRate);
  speechRateRef.current = speechRate;

  const {
    url,
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
    loadContent,
    play,
    pause,
    togglePlayPause,
    nextChunk,
    prevChunk,
    repeatChunk,
    restart,
    jumpToHeading,
  } = useReader();
  const setLastSession = useSettingsStore((s) => s.setLastSession);

  // Mirror the loaded URL + paragraph position into the persisted resume
  // slot. Skip during the initial render and skip if we have no URL (a
  // preloaded AI Vision blurb has no resume target).
  useEffect(() => {
    if (!url) return;
    setLastSession({
      route: "/reader",
      payload: { url, title, chunkIndex: currentChunk, total: chunks.length },
      updatedAt: Date.now(),
    });
  }, [url, title, currentChunk, chunks.length, setLastSession]);

  // Pick up text handed off from another module (today: AI Vision) or a
  // resume-on-launch payload from HomePage. Clear route state after
  // consuming so refresh / back-nav don't replay it.
  useEffect(() => {
    const state = location.state as PreloadState | null;
    if (state?.preload?.text) {
      const p = state.preload;
      loadContent(p.title || `From ${p.source}`, `<p>${escapeHtml(p.text)}</p>`);
      announce(`Loaded text from ${p.source}`);
      speechEngine.interrupt(`Loaded text from ${p.source}. Tap play to read it aloud.`);
      navigate(location.pathname, { replace: true });
    } else if (state?.resume?.url) {
      // Resume flow — seed sessionStorage with the persisted chunk index
      // BEFORE calling loadUrl so the existing resume path inside useReader
      // picks it up naturally without a second restore step. This is the
      // cleanest way to bridge cross-session resume (localStorage) into the
      // in-session position memory (sessionStorage) the Reader already uses.
      const { url: resumeUrl, chunkIndex } = state.resume;
      try {
        sessionStorage.setItem(
          "isvisible.reader.pos:" + resumeUrl,
          String(chunkIndex)
        );
      } catch {
        // ignore — resume just won't restore to the exact paragraph
      }
      setUrlInput(resumeUrl);
      loadUrl(resumeUrl);
      navigate(location.pathname, { replace: true });
    }
    // Mount-only effect — captures the initial location.state. Subsequent
    // route changes shouldn't replay preload/resume.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    announce("Accessible Reader is ready. Enter a URL to read.");
    speechEngine.speak("Accessible Reader. Enter a URL and tap load to read any webpage.");

    // Keyboard shortcuts
    function handleKeyDown(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (isInteractiveShortcutTarget(e.target)) return;

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

  useEffect(() => {
    function runReaderVoiceAction(action: VoiceAction | undefined) {
      switch (action) {
        case "reader_play":
          play();
          break;
        case "reader_pause":
          pause();
          break;
        case "reader_next":
          nextChunk();
          break;
        case "reader_previous":
          prevChunk();
          break;
        case "speed_up": {
          const next = changeReaderSpeed(0.2);
          announce(`Speed ${next.toFixed(1)}x`);
          speechEngine.interrupt(`Speed ${next.toFixed(1)}x`);
          break;
        }
        case "slow_down": {
          const next = changeReaderSpeed(-0.2);
          announce(`Speed ${next.toFixed(1)}x`);
          speechEngine.interrupt(`Speed ${next.toFixed(1)}x`);
          break;
        }
      }
    }

    function handleVoiceAction(event: Event) {
      runReaderVoiceAction((event as CustomEvent<{ action: VoiceAction }>).detail?.action);
    }

    window.addEventListener(MODULE_VOICE_ACTION_EVENT, handleVoiceAction);
    const pending = takePendingVoiceAction(location.pathname);
    if (pending) runReaderVoiceAction(pending);
    return () => window.removeEventListener(MODULE_VOICE_ACTION_EVENT, handleVoiceAction);
  }, [announce, location.pathname, nextChunk, pause, play, prevChunk]);

  // Track in-article text selections so the Tactile handoff can offer a
  // "selected text" mode. We only count selections that actually intersect
  // the article body — clicking around the toolbar shouldn't surface a
  // bogus "send selection" CTA. The listener is global because the
  // selection range can start outside the article (e.g. triple-click that
  // bleeds into surrounding nodes) and still meaningfully intersect.
  useEffect(() => {
    function readSelection() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelectedText("");
        return;
      }
      const text = sel.toString().trim();
      if (!text) {
        setSelectedText("");
        return;
      }
      const article = articleRef.current;
      if (!article) {
        setSelectedText("");
        return;
      }
      // Walk the selection's ranges and see if any of them touches the
      // article subtree. Range.intersectsNode is the cheapest reliable
      // check and handles selections that start before / end after the
      // article container.
      for (let i = 0; i < sel.rangeCount; i++) {
        if (sel.getRangeAt(i).intersectsNode(article)) {
          setSelectedText(text);
          return;
        }
      }
      setSelectedText("");
    }
    document.addEventListener("selectionchange", readSelection);
    return () => document.removeEventListener("selectionchange", readSelection);
  }, [htmlContent]);

  const sendSelectionToTactile = useCallback(() => {
    if (!selectedText) {
      // The button hides when the selection collapses, but a click can still
      // land after the selection is cleared (e.g. a stray selectionchange
      // between render and handler) — say so instead of silently doing nothing.
      announce("No text selected. Select a passage in the article first.");
      speechEngine.interrupt("No text selected. Select a passage in the article first.");
      return;
    }
    pushTactileHandoff(selectedText, "Reader selection");
    speechEngine.interrupt("Sending selected text to Tactile Lab.");
    navigate("/tactile-output");
  }, [announce, navigate, selectedText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      let url = urlInput.trim();
      if (!url.startsWith("http")) url = `https://${url}`;
      loadUrl(url);
    }
  };

  // Escape user-provided text before wrapping it in HTML for loadContent.
  // The text comes from AI Vision output, which is a remote source — we won't
  // let it inject markup into the Reader DOM.
  function escapeHtml(input: string): string {
    return input
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

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

          {chunks.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  // Prefer the currently-playing chunk so users can drill on
                  // the bit they're hearing. If nothing is in focus, ship the
                  // whole article — the Tactile Lab will cap the length.
                  const fallback = chunks.join(" ");
                  const focused = chunks[currentChunk] ?? fallback;
                  const payload = focused.length > 0 ? focused : fallback;
                  pushTactileHandoff(payload, "Reader");
                  speechEngine.interrupt("Sending text to Tactile Lab.");
                  navigate("/tactile-output");
                }}
                aria-label="Send the current paragraph (or the whole article if none is playing) to the Tactile Lab"
              >
                <IconBraille className="w-5 h-5 inline mr-1" /> Send to Tactile Lab
              </Button>
              {selectedText && (
                <Button
                  variant="secondary"
                  onClick={sendSelectionToTactile}
                  aria-label={`Send the ${selectedText.length} selected characters to the Tactile Lab`}
                  data-testid="send-selection-to-tactile"
                >
                  <IconBraille className="w-5 h-5 inline mr-1" /> Send selection ({selectedText.length} chars)
                </Button>
              )}
            </div>
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
              ref={articleRef}
              className={`prose prose-invert max-w-none leading-relaxed ${
                highContrast ? "text-white" : "text-gray-200"
              }`}
              style={{ fontSize: `${fontSize}px`, lineHeight: 1.6 }}
              dangerouslySetInnerHTML={{ __html: htmlContent }}
              role="article"
            />
          ) : (
            !isLoading && !error && (
              <div className="text-center text-gray-400 py-20">
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
        <div className="sticky bottom-above-nav bg-gray-900/95 backdrop-blur border-t border-gray-700 px-4 py-3">
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

          {/* Secondary controls — Repeat and Restart sit below the
              primary play row so they don't crowd the main interaction
              but stay one tap away for blind users replaying a paragraph
              or starting a long article over. */}
          <div className="flex items-center justify-center gap-2 max-w-lg mx-auto mt-2">
            <button
              type="button"
              onClick={repeatChunk}
              className="min-h-touch px-3 py-2 rounded-lg text-sm font-medium bg-surface-2 hover:bg-surface-3 text-stone-100 border border-surface-border focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 inline-flex items-center gap-1"
              aria-label="Repeat current paragraph"
            >
              <IconRefresh className="w-4 h-4" /> Repeat
            </button>
            {url && currentChunk > 0 && (
              <button
                type="button"
                onClick={restart}
                className="min-h-touch px-3 py-2 rounded-lg text-sm font-medium bg-surface-2 hover:bg-surface-3 text-stone-100 border border-surface-border focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                aria-label="Restart article from the beginning"
              >
                Restart
              </button>
            )}
          </div>

          {/* Progress */}
          <div className="max-w-lg mx-auto mt-2">
            <div className="flex justify-between text-xs text-gray-400">
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
