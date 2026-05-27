/**
 * SpeechRecognition — Web Speech API wrapper for voice commands.
 * Push-to-talk mode (default): listens only when activated.
 *
 * Returns up to 5 alternative transcripts because browsers (especially
 * Chrome on Android) often get the top guess wrong but a lower-ranked
 * alternative right — the command matcher tries each in order and picks
 * the best fit.
 */

export interface RecognitionResult {
  /** Top transcript — what the browser thinks was most likely said. */
  transcript: string;
  /** Up to 5 alternatives, top first, lowercased and trimmed. */
  alternatives: string[];
}

class SpeechRecognitionEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private isListening = false;
  private readonly timeoutMs = 10000;
  private readonly maxAlternatives = 5;

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

      rec.continuous = false;
      rec.interimResults = false;
      rec.maxAlternatives = this.maxAlternatives;
      // Prefer the user's browser locale so accented English (en-GB, en-IN,
      // en-AU) and other languages get a better acoustic model. Fall back
      // to en-US when navigator.language is unavailable.
      rec.lang =
        (typeof navigator !== "undefined" && navigator.language) || "en-US";

      let settled = false;
      const timeout = window.setTimeout(() => {
        finish(() => reject(new Error("No speech detected. Try again.")));
        rec.abort();
      }, this.timeoutMs);

      const finish = (complete: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        this.isListening = false;
        complete();
      };

      rec.onresult = (event: { results: SpeechRecognitionResultList }) => {
        const result = event.results[0];
        if (!result || result.length === 0) {
          finish(() => reject(new Error("No speech detected")));
          return;
        }

        // SpeechRecognitionResult is array-like over its alternatives.
        const alternatives: string[] = [];
        for (let i = 0; i < result.length; i++) {
          const alt = result[i];
          if (alt?.transcript) {
            alternatives.push(alt.transcript.trim().toLowerCase());
          }
        }

        if (alternatives.length === 0) {
          finish(() => reject(new Error("No speech detected")));
          return;
        }

        finish(() =>
          resolve({
            transcript: alternatives[0]!,
            alternatives,
          })
        );
      };

      rec.onerror = (event: { error: string }) => {
        if (event.error === "no-speech") {
          finish(() => reject(new Error("No speech detected. Try again.")));
        } else if (event.error === "not-allowed") {
          finish(() => reject(new Error("Microphone access denied. Please grant permission.")));
        } else if (event.error === "audio-capture") {
          finish(() => reject(new Error("No microphone found. Please connect one and try again.")));
        } else if (event.error === "network") {
          finish(() => reject(new Error("Speech recognition needs a network connection.")));
        } else {
          finish(() => reject(new Error(`Speech recognition error: ${event.error}`)));
        }
      };

      rec.onend = () => {
        finish(() => reject(new Error("No speech detected. Try again.")));
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
      this.recognition.abort();
      this.isListening = false;
    }
  }

  get listening(): boolean {
    return this.isListening;
  }
}

export const speechRecognition = new SpeechRecognitionEngine();
