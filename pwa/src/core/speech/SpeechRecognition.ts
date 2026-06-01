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
 *   4. If nothing final lands within OVERALL_TIMEOUT_MS, reject.
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

const OVERALL_TIMEOUT_MS = 15000;
// 2500 ms gives a natural speaking pause between words without cutting off
// mid-phrase. The original 1400 ms was too short — "open … reader" would cut
// after "open" if the user paused even slightly between words.
const IDLE_AFTER_FINAL_MS = 2500;
const MAX_ALTERNATIVES = 5;

class SpeechRecognitionEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private isListening = false;

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
      const rec = new SpeechRecognitionClass();
      this.recognition = rec;

      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = MAX_ALTERNATIVES;
      rec.lang =
        (typeof navigator !== "undefined" && navigator.language) || "en-US";

      let settled = false;
      // Track final segments across the session so a multi-word phrase like
      // "open the accessible reader" arrives whole instead of as fragments.
      const finalSegments: string[] = [];
      // Alternatives are per-result-segment in the browser API; keep the
      // alternatives for the LAST final segment as our matcher's secondary
      // candidates. The last segment is usually the load-bearing keyword.
      let lastSegmentAlternatives: string[] = [];
      let idleTimer: number | null = null;

      const clearIdle = () => {
        if (idleTimer !== null) {
          window.clearTimeout(idleTimer);
          idleTimer = null;
        }
      };

      const overallTimeout = window.setTimeout(() => {
        if (finalSegments.length > 0) {
          // Got something; close gracefully and resolve with what we have.
          try { rec.stop(); } catch { /* already stopping */ }
        } else {
          finish(() => reject(new Error("No speech detected. Try again.")));
          try { rec.abort(); } catch { /* already aborted */ }
        }
      }, OVERALL_TIMEOUT_MS);

      const finish = (complete: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(overallTimeout);
        clearIdle();
        this.isListening = false;
        complete();
      };

      const resolveWithAccumulated = () => {
        const joined = finalSegments.join(" ").trim().toLowerCase();
        if (!joined) {
          finish(() => reject(new Error("No speech detected. Try again.")));
          return;
        }
        // Build alternatives: the full joined utterance first, then variants
        // where the last segment is swapped for each browser alternative.
        // This lets the matcher try "open reader", "open redder", "open ridder"
        // when the user said "open reader" but the browser's top guess was off.
        const alternatives: string[] = [joined];
        if (finalSegments.length > 0 && lastSegmentAlternatives.length > 1) {
          const prefix = finalSegments.slice(0, -1).join(" ").trim();
          for (const alt of lastSegmentAlternatives.slice(1)) {
            const merged = (prefix ? `${prefix} ${alt}` : alt).toLowerCase();
            if (!alternatives.includes(merged)) alternatives.push(merged);
          }
        }
        finish(() => resolve({ transcript: joined, alternatives }));
      };

      rec.onresult = (event: { resultIndex: number; results: SpeechRecognitionResultList }) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (!result || result.length === 0) continue;

          if (result.isFinal) {
            const top = result[0]?.transcript?.trim();
            if (top) {
              finalSegments.push(top);
              // Capture this segment's alternatives for the matcher.
              lastSegmentAlternatives = [];
              for (let a = 0; a < result.length; a++) {
                const alt = result[a];
                if (alt?.transcript) {
                  lastSegmentAlternatives.push(alt.transcript.trim().toLowerCase());
                }
              }
            }
            // Restart the idle timer — caller is mid-thought, not necessarily done.
            clearIdle();
            idleTimer = window.setTimeout(() => {
              try { rec.stop(); } catch { /* fall through to onend */ }
            }, IDLE_AFTER_FINAL_MS);
          } else {
            // Interim text resets the idle timer too — the user is still talking,
            // we just don't have a finalized chunk yet.
            clearIdle();
          }
        }
      };

      rec.onerror = (event: { error: string }) => {
        if (event.error === "no-speech") {
          finish(() => reject(new Error("I didn't hear you. Try again and speak right after the chime.")));
        } else if (event.error === "not-allowed") {
          finish(() => reject(new Error("Microphone access denied. Please grant permission.")));
        } else if (event.error === "audio-capture") {
          finish(() => reject(new Error("No microphone found. Please connect one and try again.")));
        } else if (event.error === "network") {
          finish(() => reject(new Error("Speech recognition needs a network connection.")));
        } else if (event.error === "aborted") {
          // We aborted on purpose (e.g. overall timeout). If we have results,
          // resolve with them — otherwise let onend handle the empty case.
          if (finalSegments.length > 0) resolveWithAccumulated();
        } else {
          finish(() => reject(new Error(`Speech recognition error: ${event.error}`)));
        }
      };

      rec.onend = () => {
        // End-of-session: resolve with whatever final segments we collected.
        if (finalSegments.length > 0) {
          resolveWithAccumulated();
        } else {
          finish(() => reject(new Error("I didn't hear you. Try again and speak right after the chime.")));
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
    });
  }

  /** Backwards-compatible single-transcript form. */
  async listen(): Promise<string> {
    const result = await this.listenWithAlternatives();
    return result.transcript;
  }

  stop() {
    if (this.recognition) {
      try { this.recognition.abort(); } catch { /* already stopped */ }
      this.isListening = false;
    }
  }

  get listening(): boolean {
    return this.isListening;
  }
}

export const speechRecognition = new SpeechRecognitionEngine();
