/**
 * SpeechRecognition — Web Speech API wrapper for voice commands.
 *
 * Uses *continuous* mode with interim results and an idle-silence timer so
 * a user can speak a multi-word phrase without the browser cutting them off
 * after the first word (the default non-continuous mode ends on any pause,
 * which feels broken — "open … reader" gets captured as just "open").
 *
 * Flow:
 *   1. Start in continuous mode with interim results enabled.
 *   2. As final results stream in, accumulate them and reset the idle timer.
 *   3. After IDLE_AFTER_FINAL_MS of silence post-final, stop and resolve
 *      with the joined transcript.
 *   4. If the browser ends early with no speech, restart until the overall
 *      listening window expires.
 *   5. If nothing final lands within OVERALL_TIMEOUT_MS, fall back to the
 *      latest interim transcript before rejecting.
 *
 * Each final result carries up to `maxAlternatives` candidates, so the
 * command matcher still gets multiple guesses for the *last* segment
 * (which is usually the load-bearing keyword in a command).
 */

export interface RecognitionResult {
  /** Top transcript — joined across all final segments. */
  transcript: string;
  /** Up to 5 alternatives for the full utterance, top first, lowercased. */
  alternatives: string[];
}

export const OVERALL_TIMEOUT_MS = 30000;
// 4000 ms gives a natural pause for users who are locating keys, thinking
// through a phrase, or speaking slowly. Shorter windows made voice nav feel
// like it stopped listening before the command was finished.
export const IDLE_AFTER_FINAL_MS = 4000;
export const STOPPED_ERROR_MESSAGE = "Speech recognition stopped.";
const RESTART_AFTER_EARLY_END_MS = 120;
const MAX_EMPTY_RESTARTS = 6;
const MAX_ALTERNATIVES = 5;
const MAX_BUILT_ALTERNATIVES = 20;

export function buildRecognitionAlternatives(
  finalSegments: string[],
  segmentAlternatives: string[][]
): string[] {
  const normalizedSegments = finalSegments
    .map((segment) => segment.trim().toLowerCase())
    .filter(Boolean);

  const alternatives = new Set<string>([
    normalizedSegments.join(" ").trim(),
  ]);

  if (normalizedSegments.length === 0) {
    return Array.from(alternatives);
  }

  const pools = normalizedSegments.map((segment, index) => {
    const candidatePool = (segmentAlternatives[index] ?? [segment])
      .map((candidate) => candidate.trim().toLowerCase())
      .filter(Boolean);

    return (candidatePool.length > 0 ? candidatePool : [segment]).slice(0, MAX_ALTERNATIVES);
  });

  let candidates = [""];
  for (const pool of pools) {
    const next: string[] = [];
    for (const prefix of candidates) {
      for (const value of pool) {
        const candidate = `${prefix} ${value}`.replace(/\s+/g, " ").trim();
        if (candidate) next.push(candidate);
        if (next.length >= MAX_BUILT_ALTERNATIVES) break;
      }
      if (next.length >= MAX_BUILT_ALTERNATIVES) break;
    }
    candidates = next;
    for (const candidate of candidates) {
      alternatives.add(candidate);
      if (alternatives.size >= MAX_BUILT_ALTERNATIVES) break;
    }
    if (alternatives.size >= MAX_BUILT_ALTERNATIVES) break;
  }

  return Array.from(alternatives).slice(0, MAX_BUILT_ALTERNATIVES);
}

class SpeechRecognitionEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private isListening = false;
  private markStopRequested: (() => void) | null = null;

  get isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
  }

  /** Listen for a single utterance and return all candidate transcripts. */
  listenWithAlternatives(): Promise<RecognitionResult> {
    return new Promise((resolve, reject) => {
      if (!this.isSupported) {
        reject(new Error("Speech recognition not supported in this browser"));
        return;
      }

      if (this.isListening) {
        this.stop();
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognitionClass = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
      let settled = false;
      // Track final segments across the session so a multi-word phrase like
      // "open the accessible reader" arrives whole instead of as fragments.
      const finalSegments: string[] = [];
      // Capture alternatives for every final segment so the matcher can try
      // full-phrase variants, not just the last word or last chunk.
      const finalSegmentAlternatives: string[][] = [];
      let idleTimer: number | null = null;
      let restartTimer: number | null = null;
      let latestInterim = "";
      let emptyRestarts = 0;
      let stoppingForTimeout = false;
      let stopRequested = false;
      // The browser can deliver late events from a previous recognizer after
      // a restart. Keep cleanup scoped to the instance that is currently live.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let activeRecognition: any = null;
      const startedAt = Date.now();
      this.markStopRequested = () => {
        stopRequested = true;
      };

      const clearIdle = () => {
        if (idleTimer !== null) {
          window.clearTimeout(idleTimer);
          idleTimer = null;
        }
      };

      const clearRestart = () => {
        if (restartTimer !== null) {
          window.clearTimeout(restartTimer);
          restartTimer = null;
        }
      };

      const canKeepListening = () =>
        Date.now() - startedAt + RESTART_AFTER_EARLY_END_MS < OVERALL_TIMEOUT_MS &&
        emptyRestarts < MAX_EMPTY_RESTARTS;

      const overallTimeout = window.setTimeout(() => {
        if (finalSegments.length > 0) {
          // Got something; close gracefully and resolve with what we have.
          try { this.recognition?.stop(); } catch { /* already stopping */ }
        } else if (latestInterim) {
          stoppingForTimeout = true;
          const rec = this.recognition;
          resolveWithInterim();
          try { rec?.abort(); } catch { /* already stopped */ }
        } else {
          stoppingForTimeout = true;
          const rec = this.recognition;
          finish(() => reject(new Error("No speech detected. Try again.")));
          try { rec?.abort(); } catch { /* already aborted */ }
        }
      }, OVERALL_TIMEOUT_MS);

      const finish = (complete: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(overallTimeout);
        clearIdle();
        clearRestart();
        if (this.recognition === activeRecognition) {
          this.recognition = null;
          this.isListening = false;
          this.markStopRequested = null;
        }
        complete();
      };

      const resolveWithAccumulated = () => {
        const joined = finalSegments.join(" ").trim().toLowerCase();
        if (!joined) {
          finish(() => reject(new Error("No speech detected. Try again.")));
          return;
        }
        const alternatives = buildRecognitionAlternatives(
          finalSegments,
          finalSegmentAlternatives
        );
        finish(() => resolve({ transcript: joined, alternatives }));
      };

      const resolveWithInterim = () => {
        const transcript = latestInterim.trim().toLowerCase();
        if (!transcript) {
          finish(() => reject(new Error("No speech detected. Try again.")));
          return;
        }
        finish(() => resolve({ transcript, alternatives: [transcript] }));
      };

      const scheduleRestart = () => {
        if (!canKeepListening()) return false;
        emptyRestarts += 1;
        clearRestart();
        restartTimer = window.setTimeout(() => {
          restartTimer = null;
          if (!settled && !stopRequested) startRecognition();
        }, RESTART_AFTER_EARLY_END_MS);
        return true;
      };

      const startRecognition = () => {
        if (settled) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rec = new SpeechRecognitionClass();
        activeRecognition = rec;
        this.recognition = rec;

        rec.continuous = true;
        rec.interimResults = true;
        rec.maxAlternatives = MAX_ALTERNATIVES;
        rec.lang =
          (typeof navigator !== "undefined" && navigator.language) || "en-US";

        rec.onresult = (event: { resultIndex: number; results: SpeechRecognitionResultList }) => {
          if (rec !== activeRecognition) return;
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            if (!result || result.length === 0) continue;

            if (result.isFinal) {
              const top = result[0]?.transcript?.trim();
              if (top) {
                const normalizedAlternatives = Array.from(
                  new Set(
                    Array.from({ length: result.length }, (_, a) => result[a]?.transcript)
                      .filter((value): value is string => Boolean(value && value.trim()))
                      .map((value) => value.trim().toLowerCase())
                  )
                );

                finalSegments.push(top.trim());
                finalSegmentAlternatives.push(normalizedAlternatives);
                latestInterim = "";
              }
              // Restart the idle timer — caller is mid-thought, not necessarily done.
              clearIdle();
              idleTimer = window.setTimeout(() => {
                try { rec.stop(); } catch { /* fall through to onend */ }
              }, IDLE_AFTER_FINAL_MS);
            } else {
              const interim = result[0]?.transcript?.trim();
              if (interim) latestInterim = interim;
              // Interim text resets the idle timer too — the user is still talking,
              // we just don't have a finalized chunk yet.
              clearIdle();
            }
          }
        };

        rec.onerror = (event: { error: string }) => {
          if (rec !== activeRecognition) return;
          if (event.error === "no-speech") {
            if (finalSegments.length > 0) {
              resolveWithAccumulated();
            } else if (latestInterim) {
              resolveWithInterim();
            }
            return;
          }
          if (event.error === "not-allowed") {
            finish(() => reject(new Error("Microphone access denied. Please grant permission.")));
          } else if (event.error === "audio-capture") {
            finish(() => reject(new Error("No microphone found. Please connect one and try again.")));
          } else if (event.error === "network") {
            finish(() => reject(new Error("Speech recognition needs a network connection.")));
          } else if (event.error === "aborted") {
            // We aborted on purpose (e.g. overall timeout). If we have results,
            // resolve with them — otherwise let onend handle the empty case.
            if (finalSegments.length > 0) resolveWithAccumulated();
            else if (latestInterim) resolveWithInterim();
          } else {
            finish(() => reject(new Error(`Speech recognition error: ${event.error}`)));
          }
        };

        rec.onend = () => {
          if (settled || rec !== activeRecognition) return;
          // End-of-session: resolve with whatever final segments we collected.
          if (finalSegments.length > 0) {
            resolveWithAccumulated();
          } else if (latestInterim) {
            resolveWithInterim();
          } else if (stopRequested) {
            finish(() => reject(new Error(STOPPED_ERROR_MESSAGE)));
          } else if (!stoppingForTimeout && scheduleRestart()) {
            // Browser ended early before the full listening window. Keep the
            // microphone session alive so a slow speaker is not cut off.
          } else {
            finish(() => reject(new Error("I didn't hear you. Try again and speak after the chime.")));
          }
        };

        this.isListening = true;
        try {
          rec.start();
        } catch (err) {
          finish(() =>
            reject(err instanceof Error ? err : new Error("Could not start speech recognition."))
          );
        }
      };

      startRecognition();
    });
  }

  /** Backwards-compatible single-transcript form. */
  async listen(): Promise<string> {
    const result = await this.listenWithAlternatives();
    return result.transcript;
  }

  stop() {
    if (this.recognition) {
      this.markStopRequested?.();
      try { this.recognition.abort(); } catch { /* already stopped */ }
      this.isListening = false;
    }
  }

  get listening(): boolean {
    return this.isListening;
  }
}

export const speechRecognition = new SpeechRecognitionEngine();
