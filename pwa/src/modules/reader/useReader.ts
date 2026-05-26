/**
 * useReader — Manages the reading lifecycle for the Accessible Reader.
 *
 * Splits content into chunks, reads them sequentially via SpeechEngine,
 * supports pause/resume, skip forward/backward, and speed control.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { cleanContent, splitIntoChunks } from "./contentCleaner";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useAnnounce } from "@/core/a11y/AriaLive";

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
};

export function useReader() {
  const [state, setState] = useState<ReaderState>(initialState);
  const announce = useAnnounce();
  const readingRef = useRef(false);
  const chunkIndexRef = useRef(0);
  const chunksRef = useRef<string[]>([]);

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

        chunksRef.current = chunks;
        chunkIndexRef.current = 0;

        setState((s) => ({
          ...s,
          title,
          htmlContent: content,
          headings,
          chunks,
          currentChunk: 0,
          isLoading: false,
        }));

        announce(`Loaded: ${title}`);
        speechEngine.interrupt(`Article loaded. ${title}. ${chunks.length} sections. Say read or tap play to start.`);
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

      setState((s) => ({
        ...s,
        title,
        htmlContent: content,
        headings,
        chunks,
        currentChunk: 0,
        isLoading: false,
        error: null,
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

    speechEngine.setEventHandler((event) => {
      if (event === "end" && readingRef.current) {
        chunkIndexRef.current++;
        readCurrentChunk();
      }
    });

    speechEngine.speak(chunk);
  }, []);

  // Start/resume reading
  const play = useCallback(() => {
    if (chunksRef.current.length === 0) {
      speechEngine.interrupt("No article loaded. Enter a URL first.");
      return;
    }

    readingRef.current = true;
    setState((s) => ({ ...s, isReading: true, isPaused: false }));
    readCurrentChunk();
  }, [readCurrentChunk]);

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
      speechEngine.stop();
      readingRef.current = false;
      setState((s) => ({
        ...s,
        currentChunk: chunkIndexRef.current,
        isReading: false,
        isPaused: true,
      }));
      const chunk = chunksRef.current[chunkIndexRef.current]!;
      speechEngine.interrupt(chunk);
    }
  }, []);

  // Skip to previous chunk
  const prevChunk = useCallback(() => {
    if (chunkIndexRef.current > 0) {
      chunkIndexRef.current--;
      speechEngine.stop();
      readingRef.current = false;
      setState((s) => ({
        ...s,
        currentChunk: chunkIndexRef.current,
        isReading: false,
        isPaused: true,
      }));
      const chunk = chunksRef.current[chunkIndexRef.current]!;
      speechEngine.interrupt(chunk);
    }
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
        speechEngine.stop();
        readingRef.current = false;
        setState((s) => ({
          ...s,
          currentChunk: chunkIdx,
          isReading: false,
          isPaused: true,
        }));
        speechEngine.interrupt(`${heading.text}`);
      }
    },
    [state.headings]
  );

  // Cleanup
  useEffect(() => {
    return () => {
      readingRef.current = false;
      speechEngine.stop();
    };
  }, []);

  return {
    ...state,
    loadUrl,
    loadContent,
    play,
    pause,
    togglePlayPause,
    nextChunk,
    prevChunk,
    jumpToHeading,
  };
}

/**
 * Fetch an article through our own server-side fetcher. The server validates
 * the URL, refuses private/link-local IPs (SSRF), caps the body size,
 * enforces a timeout, follows redirects with a hop limit, and strips cookies.
 * We no longer touch any third-party CORS proxy.
 */
async function fetchArticleHtml(url: string): Promise<string> {
  const response = await fetch("/api/reader/fetch", {
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
