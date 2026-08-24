/**
 * HapticIntensityControl — Segmented control for vibration strength
 * (gentle / standard / strong). Writes hapticIntensity to the settings
 * store; useHaptics + useTouchExplorer push it into HapticEngine.
 * Changes are announced and echoed by speech. Respects hapticEnabled:
 * when haptics are off the control stays operable but says so.
 */

import { useAnnounce } from "@/core/a11y/AriaLive";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useSettingsStore } from "@/core/store/settingsStore";
import { toggleActive, toggleInactive } from "@/components/PageShell";

const LEVELS = [
  { value: 0.5, label: "Gentle" },
  { value: 1.0, label: "Standard" },
  { value: 1.5, label: "Strong" },
] as const;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0";

export function HapticIntensityControl() {
  const announce = useAnnounce();
  const hapticEnabled = useSettingsStore((s) => s.hapticEnabled);
  const hapticIntensity = useSettingsStore((s) => s.hapticIntensity);
  const setHapticIntensity = useSettingsStore((s) => s.setHapticIntensity);

  const select = (value: number, label: string) => {
    if (value === hapticIntensity) return;
    setHapticIntensity(value);
    const message = hapticEnabled
      ? `Haptic intensity ${label.toLowerCase()}`
      : `Haptic intensity ${label.toLowerCase()}. Haptics are currently off.`;
    announce(message);
    speechEngine.speak(message);
  };

  return (
    <div>
      <div
        role="group"
        aria-label="Haptic intensity"
        className="flex gap-2"
      >
        {LEVELS.map(({ value, label }) => {
          const active = hapticIntensity === value;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              onClick={() => select(value, label)}
              className={`${active ? toggleActive : toggleInactive} px-4 ${focusRing}`}
            >
              {label}
            </button>
          );
        })}
      </div>
      {!hapticEnabled && (
        <p className="mt-2 text-xs text-accent-300">
          Haptic feedback is off — turn it on in Settings to feel the difference.
        </p>
      )}
    </div>
  );
}
