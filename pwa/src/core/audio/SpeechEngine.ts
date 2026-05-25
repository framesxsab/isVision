/**
 * SpeechEngine — Core text-to-speech system for isVisible.
 *
 * Handles the Chrome mobile bug where long utterances silently stop
 * by chunking text at sentence boundaries (~200 chars per chunk).
 * Provides queue management and interrupt capability.
 */

type SpeechSettings = {
  rate: number;
  pitch: number;
  volume: number;
  voiceURI: string | null;
};

type SpeechEventHandler = (event: "start" | "end" | "error") => void;

const MAX_CHUNK_LENGTH = 200;

class SpeechEngineImpl {
  private synth: SpeechSynthesis | null = null;
  private queue: string[] = [];
  private isSpeaking = false;
  private settings: SpeechSettings = {
    rate: 1.0,
    pitch: 1.0,
    volume: 1.0,
    voiceURI: null,
  };
  private onEvent: SpeechEventHandler | null = null;
  private initialized = false;

  init() {
    if (this.initialized) return;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      this.synth = window.speechSynthesis;
      this.initialized = true;
    }
  }

  setEventHandler(handler: SpeechEventHandler) {
    this.onEvent = handler;
  }

  setRate(rate: number) {
    this.settings.rate = Math.max(0.1, Math.min(10, rate));
  }

  setPitch(pitch: number) {
    this.settings.pitch = Math.max(0, Math.min(2, pitch));
  }

  setVolume(volume: number) {
    this.settings.volume = Math.max(0, Math.min(1, volume));
  }

  setVoice(voiceURI: string | null) {
    this.settings.voiceURI = voiceURI;
  }

  getSettings(): Readonly<SpeechSettings> {
    return { ...this.settings };
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.synth?.getVoices() ?? [];
  }

  /**
   * Add text to queue and start speaking.
   * Text is automatically chunked at sentence boundaries.
   */
  speak(text: string) {
    this.init();
    if (!this.synth) return;

    const chunks = this.chunkText(text);
    this.queue.push(...chunks);

    if (!this.isSpeaking) {
      this.processQueue();
    }
  }

  /**
   * Cancel everything and speak this immediately.
   * Used by Touch Explorer for instant feedback.
   */
  interrupt(text: string) {
    this.init();
    if (!this.synth) return;

    this.synth.cancel();
    this.queue = [];
    this.isSpeaking = false;

    const chunks = this.chunkText(text);
    this.queue.push(...chunks);
    this.processQueue();
  }

  /** Stop all speech and clear the queue. */
  stop() {
    if (!this.synth) return;
    this.synth.cancel();
    this.queue = [];
    this.isSpeaking = false;
    this.onEvent?.("end");
  }

  /** Pause current speech. */
  pause() {
    this.synth?.pause();
  }

  /** Resume paused speech. */
  resume() {
    this.synth?.resume();
  }

  get speaking(): boolean {
    return this.isSpeaking;
  }

  private processQueue() {
    if (!this.synth || this.queue.length === 0) {
      this.isSpeaking = false;
      this.onEvent?.("end");
      return;
    }

    this.isSpeaking = true;
    const text = this.queue.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = this.settings.rate;
    utterance.pitch = this.settings.pitch;
    utterance.volume = this.settings.volume;

    // Set voice if specified
    if (this.settings.voiceURI) {
      const voice = this.synth
        .getVoices()
        .find((v) => v.voiceURI === this.settings.voiceURI);
      if (voice) utterance.voice = voice;
    }

    utterance.onstart = () => {
      if (this.queue.length === 0) {
        // Only fire "start" for the first chunk of a speech
      }
      this.onEvent?.("start");
    };

    utterance.onend = () => {
      this.processQueue(); // Speak next chunk
    };

    utterance.onerror = (e) => {
      // "interrupted" is normal when we call cancel()
      if (e.error !== "interrupted") {
        console.error("Speech error:", e.error);
        this.onEvent?.("error");
      }
      this.isSpeaking = false;
    };

    this.synth.speak(utterance);
  }

  /**
   * Split text into chunks at sentence boundaries.
   * Keeps chunks under MAX_CHUNK_LENGTH to avoid Chrome mobile bug.
   */
  private chunkText(text: string): string[] {
    if (text.length <= MAX_CHUNK_LENGTH) return [text];

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      if (remaining.length <= MAX_CHUNK_LENGTH) {
        chunks.push(remaining);
        break;
      }

      // Find the best break point: sentence end, then comma, then space
      let breakAt = -1;
      const searchRange = remaining.slice(0, MAX_CHUNK_LENGTH);

      // Try sentence boundaries first
      const sentenceEnd = Math.max(
        searchRange.lastIndexOf(". "),
        searchRange.lastIndexOf("! "),
        searchRange.lastIndexOf("? ")
      );
      if (sentenceEnd > MAX_CHUNK_LENGTH * 0.3) {
        breakAt = sentenceEnd + 2;
      }

      // Try comma
      if (breakAt === -1) {
        const comma = searchRange.lastIndexOf(", ");
        if (comma > MAX_CHUNK_LENGTH * 0.3) {
          breakAt = comma + 2;
        }
      }

      // Try any space
      if (breakAt === -1) {
        const space = searchRange.lastIndexOf(" ");
        if (space > 0) {
          breakAt = space + 1;
        }
      }

      // Last resort: hard break
      if (breakAt === -1) {
        breakAt = MAX_CHUNK_LENGTH;
      }

      chunks.push(remaining.slice(0, breakAt).trim());
      remaining = remaining.slice(breakAt).trim();
    }

    return chunks.filter((c) => c.length > 0);
  }
}

// Singleton instance
export const speechEngine = new SpeechEngineImpl();
