/**
 * useReader — Manages the reading lifecycle for the Accessible Reader.
 *
 * Splits content into chunks, reads them sequentially via SpeechEngine,
 * supports pause/resume, skip forward/backward, and speed control.
 */

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { cleanContent, splitIntoChunks } from "./contentCleaner";
import { splitIntoSentences } from "./readingHelpers";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { detectSpeechSynthesis } from "@/core/utils/capabilities";

// Per-URL paragraph position is kept in sessionStorage — survives an
// accidental refresh during a study session, but clears at tab close so
// nothing is silently retained across sessions for privacy.
const POSITION_KEY_PREFIX = "isvisible.reader.pos:";
const API_READER_FETCH = "/api/reader/fetch";

function readSavedPosition(url: string): number | null {
  try {
    const raw = sessionStorage.getItem(POSITION_KEY_PREFIX + url);
    if (raw == null) return null;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

function writeSavedPosition(url: string, index: number) {
  try {
    sessionStorage.setItem(POSITION_KEY_PREFIX + url, String(index));
  } catch {
    // Storage full or denied — silently skip. Position memory is a nicety,
    // not a correctness requirement.
  }
}

interface ReaderState {
  url: string;
  title: string;
  htmlContent: string;
  headings: Array<{ level: number; text: string; id: string }>;
  chunks: string[];
  currentChunk: number;
  isReading: boolean;
  isPaused: boolean;
  isLoading: boolean;
  error: string | null;
  // Sentence-by-sentence navigation. When on, playback advances one
  // sentence at a time; progress shows paragraph + sentence position.
  sentenceMode: boolean;
  currentSentenceIndex: number;
}

const initialState: ReaderState = {
  url: "",
  title: "",
  htmlContent: "",
  headings: [],
  chunks: [],
  currentChunk: 0,
  isReading: false,
  isPaused: false,
  isLoading: false,
  error: null,
  sentenceMode: false,
  currentSentenceIndex: 0,
};

export function useReader() {
  const [state, setState] = useState<ReaderState>(initialState);
  const announce = useAnnounce();
  const readingRef = useRef(false);
  const chunkIndexRef = useRef(0);
  const chunksRef = useRef<string[]>([]);
  // Mirrors state.sentenceMode / state.currentSentenceIndex for the
  // recursive readCurrentChunk closure, same pattern as chunkIndexRef.
  const sentenceModeRef = useRef(false);
  const sentenceIndexRef = useRef(0);
  // Track the URL whose position is being saved. Preload payloads from
  // other modules (AI Vision, etc.) don't have a URL — leave this empty
  // so we don't write garbage keys to sessionStorage.
  const currentUrlRef = useRef<string>("");

  // Persist position whenever the user moves through paragraphs, but only
  // for real URL-loaded articles. The very first chunk also gets saved so
  // a refresh mid-article doesn't jump back to the top.
  const persistPosition = useCallback((index: number) => {
    const url = currentUrlRef.current;
    if (url) writeSavedPosition(url, index);
  }, []);

  // Load a URL and extract content
  const loadUrl = useCallback(
    async (url: string) => {
      setState((s) => ({ ...s, isLoading: true, error: null, url }));
      announce("Loading article");
      speechEngine.interrupt("Loading article. Please wait.");

      try {
        const html = await fetchArticleHtml(url);

        const { title, content, textContent, headings } = cleanContent(html, url);
        const chunks = splitIntoChunks(textContent);

        // Resume from the saved paragraph if we've read this URL before.
        // Clamp against the new chunk count in case the source page changed.
        const saved = readSavedPosition(url);
        const resumeIndex =
          saved != null && saved < chunks.length ? saved : 0;

        chunksRef.current = chunks;
        chunkIndexRef.current = resumeIndex;
        sentenceModeRef.current = false;
        sentenceIndexRef.current = 0;
        currentUrlRef.current = url;

        setState((s) => ({
          ...s,
          title,
          htmlContent: content,
          headings,
          chunks,
          currentChunk: resumeIndex,
          isLoading: false,
          sentenceMode: false,
          currentSentenceIndex: 0,
        }));

        announce(`Loaded: ${title}`);
        if (resumeIndex > 0) {
          announce(
            `Resuming at paragraph ${resumeIndex + 1} of ${chunks.length}.`
          );
          speechEngine.interrupt(
            `Article loaded. ${title}. Resuming at paragraph ${resumeIndex + 1} of ${chunks.length}. Tap play to continue, or restart to start over.`
          );
        } else {
          speechEngine.interrupt(
            `Article loaded. ${title}. ${chunks.length} sections. Say read or tap play to start.`
          );
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Could not load the article. Check the URL and try again.";
        setState((s) => ({ ...s, isLoading: false, error: msg }));
        speechEngine.interrupt(msg);
      }
    },
    [announce]
  );

  // Load content directly (for pasted HTML or offline cache)
  const loadContent = useCallback(
    (title: string, htmlContent: string) => {
      const { content, textContent, headings } = cleanContent(htmlContent);
      const chunks = splitIntoChunks(textContent);

      chunksRef.current = chunks;
      chunkIndexRef.current = 0;
      sentenceModeRef.current = false;
      sentenceIndexRef.current = 0;
      // Preloaded content (AI Vision handoff, paste, etc.) is not URL-keyed,
      // so disable position persistence for it.
      currentUrlRef.current = "";

      setState((s) => ({
        ...s,
        url: "",
        title,
        htmlContent: content,
        headings,
        chunks,
        currentChunk: 0,
        isLoading: false,
        error: null,
        sentenceMode: false,
        currentSentenceIndex: 0,
      }));
    },
    []
  );

  // Read the current chunk and advance
  const readCurrentChunk = useCallback(() => {
    const chunks = chunksRef.current;
    const index = chunkIndexRef.current;

    if (index >= chunks.length) {
      readingRef.current = false;
      setState((s) => ({ ...s, isReading: false, isPaused: false }));
      speechEngine.interrupt("End of article.");
      return;
    }

    const chunk = chunks[index]!;
    setState((s) => ({ ...s, currentChunk: index }));
    persistPosition(index);

    // Sentence mode: speak the chunk one sentence at a time, advancing to
    // the next chunk when the last sentence finishes. Paragraph position
    // (and resume persistence) still tracks whole chunks.
    if (sentenceModeRef.current) {
      const sentences = splitIntoSentences(chunk);
      if (sentences.length === 0) {
        chunkIndexRef.current = index + 1;
        sentenceIndexRef.current = 0;
        readCurrentChunk();
        return;
      }

      const speakSentenceAt = (sentenceIdx: number) => {
        if (sentenceIdx >= sentences.length) {
          chunkIndexRef.current = index + 1;
          sentenceIndexRef.current = 0;
          setState((s) => ({ ...s, currentSentenceIndex: 0 }));
          readCurrentChunk();
          return;
        }
        sentenceIndexRef.current = sentenceIdx;
        setState((s) => ({ ...s, currentSentenceIndex: sentenceIdx }));
        speechEngine.speak(sentences[sentenceIdx]!, {
          onEnd: () => {
            if (!readingRef.current) return;
            speakSentenceAt(sentenceIdx + 1);
          },
          onError: () => {
            if (!readingRef.current) return;
            readingRef.current = false;
            speechEngine.stop();
            setState((s) => ({ ...s, isReading: false, isPaused: true }));
            announce("Reading stopped because speech failed.");
          },
        });
      };

      speakSentenceAt(Math.min(sentenceIndexRef.current, sentences.length - 1));
      return;
    }

    speechEngine.speak(chunk, {
      onEnd: () => {
        if (!readingRef.current) return;
        chunkIndexRef.current++;
        readCurrentChunk();
      },
      // A real synthesis failure (not a user cancel — the engine filters
      // those out) must not leave the reader in a phantom "reading" state.
      // Stop cleanly and tell the user, rather than hanging silently.
      onError: () => {
        if (!readingRef.current) return;
        readingRef.current = false;
        speechEngine.stop();
        setState((s) => ({ ...s, isReading: false, isPaused: true }));
        announce("Reading stopped because speech failed.");
      },
    });
  }, [announce, persistPosition]);

  // Start/resume reading
  const play = useCallback(() => {
    if (chunksRef.current.length === 0) {
      speechEngine.interrupt("No article loaded. Enter a URL first.");
      return;
    }

    if (!detectSpeechSynthesis().available) {
      readingRef.current = false;
      setState((s) => ({ ...s, isReading: false, isPaused: true }));
      announce(
        "Speech is not available in this browser. Use the paragraph buttons to move through the article."
      );
      return;
    }

    readingRef.current = true;
    setState((s) => ({ ...s, isReading: true, isPaused: false }));
    readCurrentChunk();
  }, [announce, readCurrentChunk]);

  // Pause reading
  const pause = useCallback(() => {
    readingRef.current = false;
    speechEngine.stop();
    setState((s) => ({ ...s, isReading: false, isPaused: true }));
    announce("Paused");
  }, [announce]);

  // Toggle play/pause
  const togglePlayPause = useCallback(() => {
    if (readingRef.current) {
      pause();
    } else {
      play();
    }
  }, [play, pause]);

  // Skip to next chunk
  const nextChunk = useCallback(() => {
    if (chunkIndexRef.current < chunksRef.current.length - 1) {
      chunkIndexRef.current++;
      sentenceIndexRef.current = 0;
      speechEngine.stop();
      readingRef.current = false;
      setState((s) => ({
        ...s,
        currentChunk: chunkIndexRef.current,
        currentSentenceIndex: 0,
        isReading: false,
        isPaused: true,
      }));
      persistPosition(chunkIndexRef.current);
      const chunk = chunksRef.current[chunkIndexRef.current]!;
      speechEngine.interrupt(chunk);
    }
  }, [persistPosition]);

  // Skip to previous chunk
  const prevChunk = useCallback(() => {
    if (chunkIndexRef.current > 0) {
      chunkIndexRef.current--;
      sentenceIndexRef.current = 0;
      speechEngine.stop();
      readingRef.current = false;
      setState((s) => ({
        ...s,
        currentChunk: chunkIndexRef.current,
        currentSentenceIndex: 0,
        isReading: false,
        isPaused: true,
      }));
      persistPosition(chunkIndexRef.current);
      const chunk = chunksRef.current[chunkIndexRef.current]!;
      speechEngine.interrupt(chunk);
    }
  }, [persistPosition]);

  // Re-read the current paragraph without advancing — different from
  // pause+play, which would re-start the chunk only if speech had ended,
  // and useless if the user just wants to hear it again from the top.
  const repeatChunk = useCallback(() => {
    const chunks = chunksRef.current;
    const index = chunkIndexRef.current;
    if (index < 0 || index >= chunks.length) return;
    speechEngine.stop();
    readingRef.current = false;
    setState((s) => ({ ...s, isReading: false, isPaused: true }));
    speechEngine.interrupt(chunks[index]!);
  }, []);

  // Wipe the saved position for the current URL and rewind to the top.
  // Lets the user explicitly choose to start over when resume isn't wanted.
  const restart = useCallback(() => {
    const url = currentUrlRef.current;
    if (url) {
      try {
        sessionStorage.removeItem(POSITION_KEY_PREFIX + url);
      } catch {
        // ignore
      }
    }
    chunkIndexRef.current = 0;
    sentenceIndexRef.current = 0;
    speechEngine.stop();
    readingRef.current = false;
    setState((s) => ({
      ...s,
      currentChunk: 0,
      currentSentenceIndex: 0,
      isReading: false,
      isPaused: true,
    }));
    speechEngine.interrupt("Restarted from the top.");
  }, []);

  // Jump to a specific heading
  const jumpToHeading = useCallback(
    (headingIndex: number) => {
      const heading = state.headings[headingIndex];
      if (!heading) return;

      // Find the chunk that contains this heading text
      const chunkIdx = chunksRef.current.findIndex((c) =>
        c.includes(heading.text)
      );
      if (chunkIdx >= 0) {
        chunkIndexRef.current = chunkIdx;
        sentenceIndexRef.current = 0;
        speechEngine.stop();
        readingRef.current = false;
        setState((s) => ({
          ...s,
          currentChunk: chunkIdx,
          currentSentenceIndex: 0,
          isReading: false,
          isPaused: true,
        }));
        persistPosition(chunkIdx);
        speechEngine.interrupt(`${heading.text}`);
      }
    },
    [state.headings, persistPosition]
  );

  // Advance one sentence. Falls through to the first sentence of the next
  // paragraph at a paragraph boundary; announces at end of article.
  // Mirrors nextChunk's stop-and-preview behavior (reading pauses, the
  // sentence is spoken immediately).
  const nextSentence = useCallback(() => {
    const chunks = chunksRef.current;
    if (chunks.length === 0) {
      speechEngine.interrupt("No article loaded. Enter a URL first.");
      return;
    }

    sentenceModeRef.current = true;

    let chunkIdx = chunkIndexRef.current;
    let sentIdx = sentenceIndexRef.current + 1;
    const currentSentences = splitIntoSentences(chunks[chunkIdx] ?? "");
    if (sentIdx >= currentSentences.length) {
      if (chunkIdx >= chunks.length - 1) {
        setState((s) => ({ ...s, sentenceMode: true }));
        speechEngine.interrupt("End of article.");
        return;
      }
      chunkIdx++;
      sentIdx = 0;
    }

    chunkIndexRef.current = chunkIdx;
    sentenceIndexRef.current = sentIdx;
    speechEngine.stop();
    readingRef.current = false;
    setState((s) => ({
      ...s,
      currentChunk: chunkIdx,
      currentSentenceIndex: sentIdx,
      sentenceMode: true,
      isReading: false,
      isPaused: true,
    }));
    persistPosition(chunkIdx);
    const sentences = splitIntoSentences(chunks[chunkIdx] ?? "");
    speechEngine.interrupt(sentences[sentIdx] ?? chunks[chunkIdx] ?? "");
  }, [persistPosition]);

  // Step back one sentence. At the start of a paragraph, lands on the last
  // sentence of the previous paragraph; announces at the very beginning.
  const prevSentence = useCallback(() => {
    const chunks = chunksRef.current;
    if (chunks.length === 0) {
      speechEngine.interrupt("No article loaded. Enter a URL first.");
      return;
    }

    sentenceModeRef.current = true;

    let chunkIdx = chunkIndexRef.current;
    let sentIdx = sentenceIndexRef.current - 1;
    if (sentIdx < 0) {
      if (chunkIdx <= 0) {
        sentenceIndexRef.current = 0;
        setState((s) => ({
          ...s,
          sentenceMode: true,
          currentSentenceIndex: 0,
        }));
        speechEngine.interrupt("Start of article.");
        return;
      }
      chunkIdx--;
      sentIdx = Math.max(0, splitIntoSentences(chunks[chunkIdx] ?? "").length - 1);
    }

    chunkIndexRef.current = chunkIdx;
    sentenceIndexRef.current = sentIdx;
    speechEngine.stop();
    readingRef.current = false;
    setState((s) => ({
      ...s,
      currentChunk: chunkIdx,
      currentSentenceIndex: sentIdx,
      sentenceMode: true,
      isReading: false,
      isPaused: true,
    }));
    persistPosition(chunkIdx);
    const sentences = splitIntoSentences(chunks[chunkIdx] ?? "");
    speechEngine.interrupt(sentences[sentIdx] ?? chunks[chunkIdx] ?? "");
  }, [persistPosition]);

  // Toggle between paragraph- and sentence-granular playback. Resets the
  // in-paragraph position so play always restarts the current paragraph
  // cleanly after a mode switch.
  const toggleSentenceMode = useCallback(() => {
    const next = !sentenceModeRef.current;
    sentenceModeRef.current = next;
    sentenceIndexRef.current = 0;
    setState((s) => ({ ...s, sentenceMode: next, currentSentenceIndex: 0 }));
    announce(
      next
        ? "Sentence navigation on. Reading moves sentence by sentence."
        : "Paragraph navigation restored."
    );
  }, [announce]);

  // Cleanup
  useEffect(() => {
    return () => {
      readingRef.current = false;
      speechEngine.stop();
    };
  }, []);

  // Sentences of the paragraph on screen right now — drives the "Sentence
  // A/B" progress readout and button disabled states.
  const currentSentences = useMemo(
    () => splitIntoSentences(state.chunks[state.currentChunk] ?? ""),
    [state.chunks, state.currentChunk]
  );

  return {
    ...state,
    currentSentences,
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
    nextSentence,
    prevSentence,
    toggleSentenceMode,
  };
}

/**
 * Fetch an article through our own server-side fetcher. The server validates
 * the URL, refuses private/link-local IPs (SSRF), caps the body size,
 * enforces a timeout, follows redirects with a hop limit, and strips cookies.
 * We no longer touch any third-party CORS proxy.
 */
async function fetchArticleHtml(url: string): Promise<string> {
  const response = await fetch(API_READER_FETCH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(
      data.error ?? `Could not load the page. Status: ${response.status}`
    );
  }

  const data = (await response.json()) as { html?: string };
  return data.html ?? "";
}
