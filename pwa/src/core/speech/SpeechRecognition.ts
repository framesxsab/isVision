/**
 * SpeechRecognition — Web Speech API wrapper for voice commands.
 * Push-to-talk mode (default): listens only when activated.
 */

class SpeechRecognitionEngine {
  private recognition: InstanceType<{ new (): { start(): void; stop(): void; abort(): void; continuous: boolean; interimResults: boolean; lang: string; onresult: ((e: { results: SpeechRecognitionResultList }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null } }> | null = null;
  private isListening = false;

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

      r.onresult = (event: { results: SpeechRecognitionResultList }) => {
        const result = event.results[0];
        if (result?.[0]) {
          resolve(result[0].transcript.trim());
        } else {
          reject(new Error("No speech detected"));
        }
        this.isListening = false;
      };

      r.onerror = (event: { error: string }) => {
        this.isListening = false;
        if (event.error === "no-speech") {
          reject(new Error("No speech detected. Try again."));
        } else if (event.error === "not-allowed") {
          reject(new Error("Microphone access denied. Please grant permission."));
        } else {
          reject(new Error(`Speech recognition error: ${event.error}`));
        }
      };

      r.onend = () => {
        this.isListening = false;
      };

      this.isListening = true;
      r.start();
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
