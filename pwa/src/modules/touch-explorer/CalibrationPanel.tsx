/**
 * CalibrationPanel — Lets users verify haptic + spatial audio feedback
 * before exploring. Three position buttons play a cue panned left /
 * centre / right; a pattern button plays the current role signature at
 * the selected intensity. Every press appends to an on-screen transcript
 * and is announced, so the panel is usable without sight or sound.
 */

import { useState } from "react";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useHaptics } from "@/core/hooks/useHaptics";
import { useSettingsStore } from "@/core/store/settingsStore";
import { spatialAudio } from "@/core/audio/SpatialAudio";
import { sectionCard } from "@/components/PageShell";

interface CalibrationSpot {
  id: string;
  label: string;
  /** Fraction of the viewport width the cue is panned to. */
  xFraction: number;
  panDescription: string;
}

const SPOTS: readonly CalibrationSpot[] = [
  { id: "left", label: "Left", xFraction: 0.08, panDescription: "panned fully left" },
  { id: "center", label: "Center", xFraction: 0.5, panDescription: "panned center" },
  { id: "right", label: "Right", xFraction: 0.92, panDescription: "panned fully right" },
] as const;

const INTENSITY_LABELS: Record<number, string> = {
  0.5: "gentle",
  1.0: "standard",
  1.5: "strong",
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0";

export function CalibrationPanel() {
  const announce = useAnnounce();
  const { vibrate, isSupported } = useHaptics();
  const spatialEnabled = useSettingsStore((s) => s.spatialAudioEnabled);
  const hapticEnabled = useSettingsStore((s) => s.hapticEnabled);
  const hapticIntensity = useSettingsStore((s) => s.hapticIntensity);
  const [transcript, setTranscript] = useState<string[]>([]);

  const addTranscript = (line: string) => {
    setTranscript((prev) => [...prev.slice(-9), line]);
  };

  const playSpot = (spot: CalibrationSpot) => {
    const x = window.innerWidth * spot.xFraction;
    const y = window.innerHeight / 2;
    if (spatialEnabled) {
      spatialAudio.playAtPosition(x, y, window.innerWidth, window.innerHeight, "button");
    }
    if (hapticEnabled) {
      vibrate([40]);
    }

    const parts = [`${spot.label} cue`];
    if (spatialEnabled) parts.push(spot.panDescription);
    if (!spatialEnabled && !hapticEnabled) {
      parts.push("audio and haptics are off in Settings");
    }
    const message = parts.join(", ");
    addTranscript(message);
    announce(message);
    speechEngine.speak(message);
  };

  const playPattern = () => {
    if (hapticEnabled) {
      vibrate([25, 40, 25]);
    }
    const intensityName = INTENSITY_LABELS[hapticIntensity] ?? String(hapticIntensity);
    const message = hapticEnabled
      ? `Double tap felt at ${intensityName} intensity`
      : "Haptics are off — enable them in Settings";
    addTranscript(message);
    announce(message);
    speechEngine.speak(message);
  };

  return (
    <section aria-label="Calibration" className={`${sectionCard} mt-4`}>
      <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400 mb-1">
        Calibration
      </h2>
      <p className="text-stone-400 text-sm mb-3">
        Press each spot to hear where it sits in your headphones and feel the
        matching tap.
      </p>

      <div className="flex flex-wrap gap-2">
        {SPOTS.map((spot) => (
          <button
            key={spot.id}
            type="button"
            onClick={() => playSpot(spot)}
            className={`min-h-touch min-w-touch flex-1 rounded-xl border border-surface-border bg-surface-2 px-4 py-2.5 font-semibold text-stone-100 hover:bg-surface-3 transition-colors ${focusRing}`}
          >
            {spot.label}
          </button>
        ))}
        <button
          type="button"
          onClick={playPattern}
          className={`min-h-touch rounded-xl border border-primary-400/50 bg-primary-500/15 px-4 py-2.5 font-semibold text-primary-100 hover:bg-primary-500/25 transition-colors ${focusRing}`}
        >
          Feel pattern
        </button>
      </div>

      {!isSupported && (
        <p className="mt-2 text-xs text-accent-300">
          This device does not support vibration — audio cues still work.
        </p>
      )}

      <h3 className="sr-only">Calibration transcript</h3>
      <div
        aria-live="polite"
        className="mt-3 rounded-xl bg-surface-0 border border-surface-divider px-3 py-2 max-h-40 overflow-y-auto"
      >
        {transcript.length === 0 ? (
          <p className="text-stone-400 text-sm">No calibration cues played yet.</p>
        ) : (
          <ol className="text-sm text-stone-300 space-y-0.5 list-decimal list-inside">
            {transcript.map((line, i) => (
              <li key={`${i}-${line}`}>{line}</li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
