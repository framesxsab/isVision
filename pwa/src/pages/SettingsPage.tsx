import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "@/core/store/settingsStore";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { Button } from "@/components/Button";
import { IconArrowLeft } from "@/components/Icons";
import { platform } from "@/core/utils/platform";
import {
  LANGUAGE_LABELS,
  checkReadiness,
  type ReadinessReport,
  type Status,
} from "@/core/utils/offlineReadiness";
import type { LiblouisTableId } from "@/modules/tactile-output/liblouisAdapter";
import { useTactileStore } from "@/modules/tactile-output/tactileStore";
import {
  DISCLOSURES,
  SCOPE_CLASSES,
  SCOPE_LABELS,
  type Disclosure,
} from "@/core/privacy/disclosures";

export default function SettingsPage() {
  const navigate = useNavigate();
  const settings = useSettingsStore();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [readinessBusy, setReadinessBusy] = useState(false);
  const [precacheBusy, setPrecacheBusy] = useState(false);
  const [precacheMessage, setPrecacheMessage] = useState("");
  const [clearMessage, setClearMessage] = useState("");
  const tactileStoreState = useTactileStore;

  useEffect(() => {
    speechEngine.init();
    const loadVoices = () => setVoices(speechEngine.getVoices());
    loadVoices();
    // Voices load asynchronously in some browsers
    speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
  }, []);

  // Sync settings to speech engine whenever they change
  useEffect(() => {
    speechEngine.setRate(settings.speechRate);
  }, [settings.speechRate]);
  useEffect(() => {
    speechEngine.setPitch(settings.speechPitch);
  }, [settings.speechPitch]);
  useEffect(() => {
    speechEngine.setVolume(settings.speechVolume);
  }, [settings.speechVolume]);
  useEffect(() => {
    speechEngine.setVoice(settings.voiceURI);
  }, [settings.voiceURI]);

  const testSpeech = () => {
    speechEngine.interrupt(
      "Hello! This is how I sound with your current settings. I am isVisible, your accessibility assistant."
    );
  };

  const runReadinessCheck = useCallback(async () => {
    setReadinessBusy(true);
    try {
      const report = await checkReadiness();
      setReadiness(report);
    } finally {
      setReadinessBusy(false);
    }
  }, []);

  const precacheLanguages = useCallback(async () => {
    setPrecacheBusy(true);
    setPrecacheMessage("");
    try {
      // Dynamic import keeps the Liblouis adapter out of the initial chunk
      // for users who never open Settings → Offline.
      const { translateWithTable } = await import(
        "@/modules/tactile-output/liblouisAdapter"
      );
      const tables: LiblouisTableId[] = ["en-g2", "fr-g2", "de-g2"];
      // Translate a tiny string in each language so the worker fetches
      // every entry table — the runtime CacheFirst handler stashes them
      // for offline use without us writing into the cache directly.
      const results = await Promise.allSettled(
        tables.map((t) => translateWithTable("a", t))
      );
      const ok = results.filter((r) => r.status === "fulfilled").length;
      setPrecacheMessage(`Primed ${ok} of ${tables.length} language tables.`);
      await runReadinessCheck();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Precache failed.";
      setPrecacheMessage(message);
    } finally {
      setPrecacheBusy(false);
    }
  }, [runReadinessCheck]);

  const clearLocalData = useCallback(() => {
    // Reset zustand-in-memory state first so persist doesn't immediately
    // rewrite the keys we're about to clear.
    tactileStoreState.persist.clearStorage();
    tactileStoreState.setState({
      lastImportedText: "",
      lastImportSource: "",
      translatorMode: "g1",
      language: "en-g2",
      groupSize: 1,
      outputFormat: "compact",
      holdMs: 900,
      blankBetweenFrames: true,
      drillScore: { attempts: 0, correct: 0, streak: 0 },
      drillMode: "letter",
      drillSpeechMode: "silent",
      drillDifficulty: "normal",
      drillHistory: [],
    });
    // Reset the general settings store too. Onboarding flag stays out of
    // the wipe — clearing it would dump the user back into the welcome
    // flow, which they almost certainly don't want from a "clear my data"
    // button.
    settings.setSpeechRate(1.0);
    settings.setSpeechPitch(1.0);
    settings.setSpeechVolume(1.0);
    settings.setVoiceURI(null);
    settings.setHighContrast(false);
    settings.setFontSize(20);
    settings.setHapticEnabled(true);
    settings.setSpatialAudioEnabled(true);
    setClearMessage("Cleared imported text, drill history, language, and per-page settings.");
  }, [settings, tactileStoreState]);

  // Run one check on mount so the panel isn't blank when the user first
  // opens Settings. Subsequent checks happen on demand via the button.
  useEffect(() => {
    void runReadinessCheck();
  }, [runReadinessCheck]);

  return (
    <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" onClick={() => navigate("/")} aria-label="Go back to home">
          <IconArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
      </div>

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
              aria-describedby="voice-hint"
              className="w-full min-h-touch bg-gray-800 text-white border border-gray-600 rounded-xl px-4 py-3"
            >
              <option value="">System default</option>
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <span id="voice-hint" className="sr-only">Choose the voice used for all speech output</span>
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
              aria-valuetext={`Pitch ${settings.speechPitch.toFixed(1)}`}
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
              aria-valuetext={`${settings.fontSize} pixels`}
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

      <OfflineReadinessSection
        report={readiness}
        busy={readinessBusy}
        onRecheck={runReadinessCheck}
        onPrecache={precacheLanguages}
        precacheBusy={precacheBusy}
        precacheMessage={precacheMessage}
      />

      <PrivacySection onClearLocalData={clearLocalData} clearMessage={clearMessage} />
    </div>
  );
}

function PrivacySection({
  onClearLocalData,
  clearMessage,
}: {
  onClearLocalData: () => void;
  clearMessage: string;
}) {
  return (
    <section aria-labelledby="privacy-heading" className="mb-8">
      <h2 id="privacy-heading" className="text-lg font-semibold text-white mb-2">
        Privacy &amp; data
      </h2>
      <p className="text-sm text-gray-300 mb-4">
        Every place this app touches your data. The coloured chip on each row
        says where it goes. Tap a row to read the longer explanation.
      </p>
      <ul className="space-y-2" aria-label="Privacy disclosures">
        {DISCLOSURES.map((d) => (
          <DisclosureRow key={d.id} disclosure={d} />
        ))}
      </ul>
      <div className="mt-4">
        <Button
          variant="secondary"
          onClick={onClearLocalData}
          aria-label="Reset every saved setting and clear all locally stored app data"
          data-testid="clear-local-data"
        >
          Clear saved data
        </Button>
        <p className="text-xs text-gray-400 mt-2">
          Resets translator/language/output choices, imported text, drill
          history, voice and display preferences. Onboarding stays marked
          complete so you don't get sent back to the welcome flow.
        </p>
        {clearMessage && (
          <p className="text-xs text-green-300 mt-2" role="status" aria-live="polite">
            {clearMessage}
          </p>
        )}
      </div>
    </section>
  );
}

function DisclosureRow({ disclosure }: { disclosure: Disclosure }) {
  const chipClasses = SCOPE_CLASSES[disclosure.scope];
  const chipLabel = SCOPE_LABELS[disclosure.scope];
  return (
    <li className="bg-gray-900 border border-gray-700 rounded-lg">
      <details className="group">
        <summary
          className="min-h-touch px-3 py-3 cursor-pointer flex items-start justify-between gap-3 list-none focus-visible:ring-2 focus-visible:ring-primary-400 rounded-lg"
          aria-describedby={`disclosure-${disclosure.id}-summary`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-white font-medium">{disclosure.title}</span>
              <span
                className={`text-xs border rounded-full px-2 py-0.5 whitespace-nowrap ${chipClasses}`}
              >
                {chipLabel}
              </span>
            </div>
            <p
              id={`disclosure-${disclosure.id}-summary`}
              className="text-sm text-gray-300 mt-1"
            >
              {disclosure.summary}
            </p>
          </div>
        </summary>
        <p className="px-3 pb-3 text-sm text-gray-300 leading-relaxed">
          {disclosure.detail}
        </p>
      </details>
    </li>
  );
}

// Section is local to this file — it's a self-contained checklist with no
// reuse value elsewhere, and lifting it out would just spread the readiness
// concept across two files.
function OfflineReadinessSection({
  report,
  busy,
  onRecheck,
  onPrecache,
  precacheBusy,
  precacheMessage,
}: {
  report: ReadinessReport | null;
  busy: boolean;
  onRecheck: () => void;
  onPrecache?: () => void;
  precacheBusy: boolean;
  precacheMessage: string;
}) {
  return (
    <section aria-labelledby="offline-heading" className="mb-8">
      <h2 id="offline-heading" className="text-lg font-semibold text-white mb-2">
        Offline readiness
      </h2>
      <p className="text-sm text-gray-300 mb-4">
        Shows what's actually cached right now. After you install the app and
        use Grade 2 once online, those assets should switch to "cached" and
        stay usable without a network.
      </p>

      {report && !report.cacheApiAvailable && (
        <p role="alert" className="text-sm text-yellow-300 mb-3">
          The Cache Storage API isn't available in this context. Install the
          PWA, or run it over HTTPS / localhost to enable the service worker.
        </p>
      )}

      <ul className="space-y-2" aria-label="Offline-readiness checklist">
        <ReadinessRow
          label="App shell"
          status={report?.appShell ?? "unknown"}
          help="Routes, JS bundles, CSS — the parts you need to open any page."
        />
        <ReadinessRow
          label="Liblouis runtime"
          status={report?.liblouisRuntime ?? "unknown"}
          help="The WASM build and Easy-API script that drive Grade 2 translation."
        />
        {report &&
          (Object.keys(report.tables) as LiblouisTableId[]).map((lang) => (
            <ReadinessRow
              key={lang}
              label={`${LANGUAGE_LABELS[lang] ?? lang} table`}
              status={report.tables[lang] ?? "unknown"}
              help="Loads on first Grade 2 translation in that language."
            />
          ))}
      </ul>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <Button onClick={onRecheck} disabled={busy} variant="secondary">
          {busy ? "Checking…" : "Check offline readiness"}
        </Button>
        {onPrecache && (
          <Button
            onClick={onPrecache}
            disabled={precacheBusy}
            variant="secondary"
            aria-label="Pre-fetch language tables so they're available offline"
          >
            {precacheBusy ? "Caching…" : "Cache language tables"}
          </Button>
        )}
        <span className="text-xs text-gray-400" aria-live="polite">
          {report ? `Last checked ${formatRelativeTime(report.checkedAt)}` : ""}
        </span>
      </div>
      {precacheMessage && (
        <p className="text-xs text-gray-300 mt-2" role="status" aria-live="polite">
          {precacheMessage}
        </p>
      )}
    </section>
  );
}

function ReadinessRow({
  label,
  status,
  help,
}: {
  label: string;
  status: Status;
  help: string;
}) {
  const { dot, copy } = renderStatus(status);
  return (
    <li className="flex items-start gap-3 bg-gray-900 border border-gray-700 rounded-lg p-3">
      <span aria-hidden="true" className={`mt-1 inline-block w-3 h-3 rounded-full ${dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-white font-medium">{label}</span>
          <span className="text-sm text-gray-300">{copy}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">{help}</p>
      </div>
    </li>
  );
}

function renderStatus(status: Status): { dot: string; copy: string } {
  if (status === "cached") {
    return { dot: "bg-green-400", copy: "Cached" };
  }
  if (status === "missing") {
    return { dot: "bg-yellow-400", copy: "Not cached yet" };
  }
  return { dot: "bg-gray-500", copy: "Unknown" };
}

function formatRelativeTime(at: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - at) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return new Date(at).toLocaleString();
}
