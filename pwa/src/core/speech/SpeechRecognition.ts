/**
 * SpeechRecognition — Web Speech API wrapper for voice commands.
 * Push-to-talk mode (default): listens only when activated.
 */

class SpeechRecognitionEngine {
  private recognition: InstanceType<{ new (): { start(): void; stop(): void; abort(): void; continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: { results: SpeechRecognitionResultList }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null } }> | null = null;
  private isListening = false;
  private readonly timeoutMs = 10000;

  get isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
  }

  /** Listen for a single utterance. Returns the transcript. */
  listen(): Promise<string> {
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
      this.recognition = new SpeechRecognitionClass();

      const rec = this.recognition!;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = rec as any;
      r.continuous = false;
      r.interimResults = false;
      r.lang = "en-US";

      let settled = false;
      const timeout = window.setTimeout(() => {
        finish(() => reject(new Error("No speech detected. Try again.")));
        r.abort();
      }, this.timeoutMs);

      const finish = (complete: () => void) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        this.isListening = false;
        complete();
      };

      r.onresult = (event: { results: SpeechRecognitionResultList }) => {
        const result = event.results[0];
        const alternative = result?.[0];
        if (alternative) {
          finish(() => resolve(alternative.transcript.trim()));
        } else {
          finish(() => reject(new Error("No speech detected")));
        }
      };

      r.onerror = (event: { error: string }) => {
        if (event.error === "no-speech") {
          finish(() => reject(new Error("No speech detected. Try again.")));
        } else if (event.error === "not-allowed") {
          finish(() => reject(new Error("Microphone access denied. Please grant permission.")));
        } else {
          finish(() => reject(new Error(`Speech recognition error: ${event.error}`)));
        }
      };

      r.onend = () => {
        finish(() => reject(new Error("No speech detected. Try again.")));
      };

      this.isListening = true;
      try {
        r.start();
      } catch (err) {
        finish(() =>
          reject(err instanceof Error ? err : new Error("Could not start speech recognition."))
        );
      }
    });
  }

  stop() {
    if (this.recognition) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.recognition as any).abort();
      this.isListening = false;
    }
  }

  get listening(): boolean {
    return this.isListening;
  }
}

export const speechRecognition = new SpeechRecognitionEngine();
