/**
 * SpatialAudio — Maps screen positions to 3D audio space.
 *
 * Uses the Web Audio API with HRTF panning so blind users can
 * perceive WHERE on screen an element is located:
 * - Left elements sound left, right elements sound right (stereo pan)
 * - Top elements have higher pitch, bottom elements lower pitch
 *
 * This gives spatial awareness of screen layout through headphones.
 */

class SpatialAudioImpl {
  private ctx: AudioContext | null = null;
  private enabled = true;

  init() {
    if (this.ctx) return;
    if (typeof window !== "undefined" && "AudioContext" in window) {
      this.ctx = new AudioContext();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  /**
   * Play a spatial audio cue at the position of an element.
   * @param x - Element center X on screen
   * @param y - Element center Y on screen
   * @param screenWidth - Viewport width
   * @param screenHeight - Viewport height
   * @param role - Element role (affects the tone character)
   */
  playAtPosition(
    x: number,
    y: number,
    screenWidth: number,
    screenHeight: number,
    role: string
  ) {
    if (!this.enabled || !this.ctx) {
      this.init();
      if (!this.ctx) return;
    }

    // Resume context if suspended (required after user gesture)
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    // Map screen position to audio parameters
    // X: -1 (left) to +1 (right) for stereo panning
    const pan = (x / screenWidth) * 2 - 1;

    // Y: higher pitch at top, lower at bottom (200-800 Hz range)
    const normalizedY = 1 - y / screenHeight; // Invert: top=1, bottom=0
    const baseFreq = 200 + normalizedY * 600;

    // Role affects the oscillator type (different timbres)
    const oscType = getRoleOscillatorType(role);
    const duration = getRoleDuration(role);

    // Create oscillator
    const osc = this.ctx.createOscillator();
    osc.type = oscType;
    osc.frequency.setValueAtTime(baseFreq, now);

    // Create stereo panner
    const panner = this.ctx.createStereoPanner();
    panner.pan.setValueAtTime(pan, now);

    // Create gain node for envelope (avoid clicks)
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.01); // Quick attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration); // Decay

    // Connect: oscillator -> panner -> gain -> output
    osc.connect(panner);
    panner.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  dispose() {
    this.ctx?.close();
    this.ctx = null;
  }
}

function getRoleOscillatorType(role: string): OscillatorType {
  switch (role) {
    case "button":
      return "square";   // Sharp, decisive
    case "link":
      return "triangle"; // Soft, inviting
    case "heading":
      return "sawtooth"; // Rich, prominent
    case "image":
      return "sine";     // Smooth, pure
    default:
      return "sine";
  }
}

function getRoleDuration(role: string): number {
  switch (role) {
    case "heading":
      return 0.15;  // Longer for landmarks
    case "button":
      return 0.08;
    case "link":
      return 0.1;
    case "text":
      return 0.05;  // Very short for plain text
    default:
      return 0.08;
  }
}

export const spatialAudio = new SpatialAudioImpl();
