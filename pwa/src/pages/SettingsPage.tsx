import { useEffect, useState } from "react";
import { useSettingsStore } from "@/core/store/settingsStore";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { Button } from "@/components/Button";
import { platform } from "@/core/utils/platform";

export default function SettingsPage() {
  const settings = useSettingsStore();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    speechEngine.init();
    const loadVoices = () => setVoices(speechEngine.getVoices());
    loadVoices();
    // Voices load asynchronously in some browsers
    speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
  }, []);

  // Sync settings to speech engine
  useEffect(() => {
    speechEngine.setRate(settings.speechRate);
    speechEngine.setPitch(settings.speechPitch);
    speechEngine.setVolume(settings.speechVolume);
    speechEngine.setVoice(settings.voiceURI);
  }, [settings.speechRate, settings.speechPitch, settings.speechVolume, settings.voiceURI]);

  const testSpeech = () => {
    speechEngine.interrupt(
      "Hello! This is how I sound with your current settings. I am isVisible, your accessibility assistant."
    );
  };

  return (
    <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Settings</h1>

      {/* Speech Settings */}
      <section aria-labelledby="speech-heading" className="mb-8">
        <h2 id="speech-heading" className="text-lg font-semibold text-white mb-4">
          Speech
        </h2>

        <div className="space-y-5">
          <div>
            <label htmlFor="voice-select" className="block text-sm text-gray-300 mb-2">
              Voice
            </label>
            <select
              id="voice-select"
              value={settings.voiceURI ?? ""}
              onChange={(e) => settings.setVoiceURI(e.target.value || null)}
              className="w-full min-h-touch bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3"
            >
              <option value="">System default</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="rate-slider" className="block text-sm text-gray-300 mb-2">
              Speed: {settings.speechRate.toFixed(1)}x
            </label>
            <input
              id="rate-slider"
              type="range"
              min="0.5"
              max="3"
              step="0.1"
              value={settings.speechRate}
              onChange={(e) => settings.setSpeechRate(parseFloat(e.target.value))}
              className="w-full min-h-touch"
              aria-valuemin={0.5}
              aria-valuemax={3}
              aria-valuenow={settings.speechRate}
              aria-valuetext={`${settings.speechRate.toFixed(1)} times speed`}
            />
          </div>

          <div>
            <label htmlFor="pitch-slider" className="block text-sm text-gray-300 mb-2">
              Pitch: {settings.speechPitch.toFixed(1)}
            </label>
            <input
              id="pitch-slider"
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.speechPitch}
              onChange={(e) => settings.setSpeechPitch(parseFloat(e.target.value))}
              className="w-full min-h-touch"
            />
          </div>

          <Button onClick={testSpeech} variant="secondary" className="w-full">
            Test speech
          </Button>
        </div>
      </section>

      {/* Display Settings */}
      <section aria-labelledby="display-heading" className="mb-8">
        <h2 id="display-heading" className="text-lg font-semibold text-white mb-4">
          Display
        </h2>

        <div className="space-y-4">
          <label className="flex items-center gap-3 min-h-touch">
            <input
              type="checkbox"
              checked={settings.highContrast}
              onChange={(e) => settings.setHighContrast(e.target.checked)}
              className="w-6 h-6 rounded"
            />
            <span className="text-white">High contrast mode</span>
          </label>

          <div>
            <label htmlFor="font-slider" className="block text-sm text-gray-300 mb-2">
              Font size: {settings.fontSize}px
            </label>
            <input
              id="font-slider"
              type="range"
              min="18"
              max="32"
              step="2"
              value={settings.fontSize}
              onChange={(e) => settings.setFontSize(parseInt(e.target.value))}
              className="w-full min-h-touch"
            />
          </div>
        </div>
      </section>

      {/* Feature Toggles */}
      <section aria-labelledby="features-heading" className="mb-8">
        <h2 id="features-heading" className="text-lg font-semibold text-white mb-4">
          Features
        </h2>

        <div className="space-y-4">
          <label className="flex items-center gap-3 min-h-touch">
            <input
              type="checkbox"
              checked={settings.hapticEnabled}
              onChange={(e) => settings.setHapticEnabled(e.target.checked)}
              disabled={!platform.supportsVibration}
              className="w-6 h-6 rounded"
            />
            <span className="text-white">
              Haptic feedback
              {!platform.supportsVibration && (
                <span className="text-gray-500 text-sm block">
                  Not supported on this device
                </span>
              )}
            </span>
          </label>

          <label className="flex items-center gap-3 min-h-touch">
            <input
              type="checkbox"
              checked={settings.spatialAudioEnabled}
              onChange={(e) => settings.setSpatialAudioEnabled(e.target.checked)}
              className="w-6 h-6 rounded"
            />
            <span className="text-white">Spatial audio cues</span>
          </label>
        </div>
      </section>
    </div>
  );
}
