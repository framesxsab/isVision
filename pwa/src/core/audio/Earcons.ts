/**
 * Earcons — Short confirmation sounds for UI actions.
 * Generated programmatically using Web Audio API (no audio files needed).
 *
 * Each earcon is a brief synthesized tone with a distinct character:
 * - success: rising two-note chime
 * - error: low buzzy tone
 * - navigate: soft click
 * - capture: shutter-like burst
 * - activate: crisp tap
 */

class EarconsImpl {
  private ctx: AudioContext | null = null;
  private enabled = true;

  private getContext(): AudioContext | null {
    if (!this.ctx && typeof window !== "undefined" && "AudioContext" in window) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /** Rising two-note chime — success, confirmation */
  success() {
    this.playTone([440, 660], [0.08, 0.08], "sine", 0.12);
  }

  /** Low buzz — error, denial */
  error() {
    this.playTone([180], [0.2], "sawtooth", 0.1);
  }

  /** Soft click — navigation, button press */
  navigate() {
    this.playTone([800], [0.03], "sine", 0.15);
  }

  /** Short burst — camera capture */
  capture() {
    this.playNoise(0.08, 0.2);
  }

  /** Crisp tap — activation, toggle */
  activate() {
    this.playTone([1000], [0.02], "square", 0.08);
  }

  private playTone(
    frequencies: number[],
    durations: number[],
    type: OscillatorType,
    volume: number
  ) {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    let offset = ctx.currentTime;

    for (let i = 0; i < frequencies.length; i++) {
      const freq = frequencies[i]!;
      const dur = durations[i] ?? 0.05;

      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, offset);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, offset);
      gain.gain.linearRampToValueAtTime(volume, offset + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, offset + dur);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(offset);
      osc.stop(offset + dur);

      offset += dur;
    }
  }

  private playNoise(duration: number, volume: number) {
    if (!this.enabled) return;
    const ctx = this.getContext();
    if (!ctx) return;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.max(0, 1 - i / bufferSize);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2000, now);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    source.start(now);
    source.stop(now + duration);
  }

  dispose() {
    this.ctx?.close();
    this.ctx = null;
  }
}

export const earcons = new EarconsImpl();
