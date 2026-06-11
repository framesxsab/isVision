import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "@/core/store/settingsStore";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { Button } from "@/components/Button";
import { IconArrowLeft } from "@/components/Icons";
import { platform } from "@/core/utils/platform";
import {
  detectCapability,
  queryMediaPermission,
  type CapabilityId,
  type CapabilityReport,
} from "@/core/utils/capabilities";
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

// Inline icon helpers — kept here to avoid bloating the shared Icons module
// for one-off section adornments.
function SectionIcon({ children, accent }: { children: ReactNode; accent: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex items-center justify-center w-9 h-9 rounded-xl border ${accent}`}
    >
      {children}
    </span>
  );
}

function SpeakerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5L6 9H2v6h4l5 4V5z" />
      <path d="M15.54 8.46a5 5 0 010 7.07" />
      <path d="M19.07 4.93a10 10 0 010 14.14" />
    </svg>
  );
}
function DisplayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}
function FeaturesIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}
function DeviceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M9 7h6M9 17h6M8 11h.01M12 11h.01M16 11h.01M8 14h.01M12 14h.01M16 14h.01" />
    </svg>
  );
}
function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />
    </svg>
  );
}
function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}
function SetupIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

function Panel({
  id,
  title,
  description,
  icon,
  accent,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  icon: ReactNode;
  accent: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="mb-5 rounded-2xl surface-panel border border-surface-border p-5 sm:p-6"
    >
      <div className="flex items-start gap-3 mb-5">
        <SectionIcon accent={accent}>{icon}</SectionIcon>
        <div className="flex-1 min-w-0">
          <h2 id={`${id}-heading`} className="text-lg font-semibold text-stone-50 tracking-tight">
            {title}
          </h2>
          {description && (
            <p className="text-sm text-stone-400 mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-4 min-h-touch px-3 -mx-3 rounded-lg cursor-pointer transition-colors hover:bg-white/[0.03] ${
        disabled ? "opacity-60 cursor-not-allowed" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <span className="text-stone-50 font-medium block">{label}</span>
        {hint && <span className="text-stone-500 text-xs block mt-0.5">{hint}</span>}
      </div>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="
            pointer-events-none block w-12 h-7 rounded-full
            bg-surface-3 border border-surface-border
            peer-checked:bg-primary-500/40 peer-checked:border-primary-400/60
            peer-focus-visible:ring-2 peer-focus-visible:ring-primary-400 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-0
            transition-colors
          "
        />
        <span
          aria-hidden="true"
          className="
            pointer-events-none absolute top-0.5 left-0.5 w-6 h-6 rounded-full
            bg-stone-200 shadow-sm
            peer-checked:translate-x-5 peer-checked:bg-white
            transition-transform
          "
        />
      </span>
    </label>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const settings = useSettingsStore();
  const setSetupStatus = useSettingsStore((s) => s.setSetupStatus);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [readiness, setReadiness] = useState<ReadinessReport | null>(null);
  const [readinessBusy, setReadinessBusy] = useState(false);
  const [precacheBusy, setPrecacheBusy] = useState(false);
  const [precacheMessage, setPrecacheMessage] = useState("");
  const [clearMessage, setClearMessage] = useState("");
  const tactileStoreState = useTactileStore;
  const persistImportedText = useTactileStore((s) => s.persistImportedText);
  const setPersistImportedText = useTactileStore((s) => s.setPersistImportedText);

  useEffect(() => {
    speechEngine.init();
    const loadVoices = () => setVoices(speechEngine.getVoices());
    loadVoices();
    speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
  }, []);

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
      const { translateWithTable } = await import(
        "@/modules/tactile-output/liblouisAdapter"
      );
      const tables: LiblouisTableId[] = ["en-g2", "fr-g2", "de-g2"];
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
    tactileStoreState.persist.clearStorage();
    tactileStoreState.setState({
      lastImportedText: "",
      lastImportSource: "",
      persistImportedText: false,
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
    settings.setSpeechRate(1.0);
    settings.setSpeechPitch(1.0);
    settings.setSpeechVolume(1.0);
    settings.setVoiceURI(null);
    settings.setHighContrast(false);
    settings.setFontSize(20);
    settings.setHapticEnabled(true);
    settings.setSpatialAudioEnabled(true);
    settings.setVisionRetainHistory(true);
    settings.setVoiceConfirmAloud(true);
    settings.resetSetupStatus();
    settings.setLastSession(null);
    setClearMessage("Cleared imported text, reader resume history, drill history, language, and per-page settings.");
  }, [settings, tactileStoreState]);

  const refreshPermissionStatus = useCallback(async () => {
    const [camera, microphone] = await Promise.all([
      queryMediaPermission("camera"),
      queryMediaPermission("microphone"),
    ]);
    setSetupStatus({
      ...(camera ? { camera } : {}),
      ...(microphone ? { microphone } : {}),
    });
  }, [setSetupStatus]);

  useEffect(() => {
    void runReadinessCheck();
  }, [runReadinessCheck]);

  useEffect(() => {
    void refreshPermissionStatus();
    const onFocus = () => void refreshPermissionStatus();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshPermissionStatus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshPermissionStatus]);

  return (
    <div className="min-h-screen px-4 sm:px-6 py-6 sm:py-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8 animate-fade-up">
        <button
          onClick={() => navigate("/")}
          aria-label="Go back to home"
          className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-surface-2 border border-surface-border text-stone-300 hover:text-stone-50 hover:bg-surface-3 transition-colors focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
        >
          <IconArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-primary-300">
            Preferences
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-50 tracking-tight">
            Settings
          </h1>
        </div>
      </div>

      {/* Speech */}
      <Panel
        id="speech"
        title="Speech"
        description="Voice, speed, and pitch for spoken output."
        icon={<span className="text-primary-300"><SpeakerIcon /></span>}
        accent="bg-primary-500/10 border-primary-400/30"
      >
        <div className="space-y-5">
          <div>
            <label htmlFor="voice-select" className="block text-sm font-medium text-stone-200 mb-2">
              Voice
            </label>
            <select
              id="voice-select"
              value={settings.voiceURI ?? ""}
              onChange={(e) => settings.setVoiceURI(e.target.value || null)}
              aria-describedby="voice-hint"
              className="w-full min-h-touch bg-surface-2 text-stone-50 border border-surface-border rounded-xl px-4 py-3 focus:border-primary-400/60 transition-colors"
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
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="rate-slider" className="text-sm font-medium text-stone-200">
                Speed
              </label>
              <span className="text-sm font-mono text-primary-300 tabular-nums">
                {settings.speechRate.toFixed(1)}x
              </span>
            </div>
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
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="pitch-slider" className="text-sm font-medium text-stone-200">
                Pitch
              </label>
              <span className="text-sm font-mono text-primary-300 tabular-nums">
                {settings.speechPitch.toFixed(1)}
              </span>
            </div>
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

          <div className="pt-4 mt-1 border-t border-surface-border">
            <ToggleRow
              checked={settings.voiceConfirmAloud}
              onChange={(v) => settings.setVoiceConfirmAloud(v)}
              label="Confirm voice commands aloud"
              hint="Speak 'I heard X' before running a recognized command. Turn off to skip the confirmation delay."
            />
          </div>
        </div>
      </Panel>

      {/* Display */}
      <Panel
        id="display"
        title="Display"
        description="Contrast and font sizing."
        icon={<span className="text-yellow-300"><DisplayIcon /></span>}
        accent="bg-yellow-500/10 border-yellow-400/30"
      >
        <div className="space-y-4">
          <ToggleRow
            checked={settings.highContrast}
            onChange={(v) => settings.setHighContrast(v)}
            label="High contrast mode"
            hint="Pure black background, pure white text, yellow accents."
          />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="font-slider" className="text-sm font-medium text-stone-200">
                Font size
              </label>
              <span className="text-sm font-mono text-primary-300 tabular-nums">
                {settings.fontSize}px
              </span>
            </div>
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
      </Panel>

      {/* Features */}
      <Panel
        id="features"
        title="Features"
        description="Haptic and spatial audio cues."
        icon={<span className="text-amber-300"><FeaturesIcon /></span>}
        accent="bg-amber-500/10 border-amber-400/30"
      >
        <div className="space-y-2">
          <ToggleRow
            checked={settings.hapticEnabled}
            onChange={(v) => settings.setHapticEnabled(v)}
            label="Haptic feedback"
            hint={!platform.supportsVibration ? "Not supported on this device" : undefined}
            disabled={!platform.supportsVibration}
          />
          <ToggleRow
            checked={settings.spatialAudioEnabled}
            onChange={(v) => settings.setSpatialAudioEnabled(v)}
            label="Spatial audio cues"
            hint="Stereo positioning hints for on-screen elements."
          />
        </div>
      </Panel>

      <SetupPanel
        setupStatus={settings.setupStatus}
        onRestart={() => navigate("/onboarding?restart=1")}
        onTroubleshoot={() => navigate("/troubleshoot")}
      />

      <DeviceCapabilitiesPanel />

      <OfflineReadinessPanel
        report={readiness}
        busy={readinessBusy}
        onRecheck={runReadinessCheck}
        onPrecache={precacheLanguages}
        precacheBusy={precacheBusy}
        precacheMessage={precacheMessage}
      />

      <PrivacyPanel
        onClearLocalData={clearLocalData}
        clearMessage={clearMessage}
        visionRetainHistory={settings.visionRetainHistory}
        onSetVisionRetainHistory={settings.setVisionRetainHistory}
        persistImportedText={persistImportedText}
        onSetPersistImportedText={setPersistImportedText}
      />
    </div>
  );
}

const CAPABILITY_ROWS: Array<{
  id: CapabilityId;
  label: string;
  help: string;
  readyAction: string;
}> = [
  {
    id: "camera",
    label: "Camera",
    help: "Used by AI Vision for scene descriptions.",
    readyAction: "Open AI Vision and grant permission when prompted.",
  },
  {
    id: "microphone",
    label: "Microphone",
    help: "Used by Voice Navigation and spoken commands.",
    readyAction: "Open Voice Navigation and grant permission when prompted.",
  },
  {
    id: "speech-recognition",
    label: "Speech recognition",
    help: "Turns spoken commands into app actions.",
    readyAction: "Press F6 or tap the microphone button to test commands.",
  },
  {
    id: "speech-synthesis",
    label: "Speech output",
    help: "Reads app responses, descriptions, and reader text aloud.",
    readyAction: "Use Test speech above to confirm the selected voice.",
  },
  {
    id: "vibration",
    label: "Vibration",
    help: "Provides haptic orientation cues on supported devices.",
    readyAction: "Keep haptic feedback enabled for touch exploration.",
  },
  {
    id: "clipboard-read",
    label: "Clipboard paste",
    help: "Imports text into Reader and Tactile Lab.",
    readyAction: "Use Paste in the Tactile Lab, or upload a text file.",
  },
  {
    id: "clipboard-write",
    label: "Clipboard copy",
    help: "Copies generated descriptions and exported frame text.",
    readyAction: "Use Copy actions where available.",
  },
  {
    id: "web-serial",
    label: "Web Serial",
    help: "Streams tactile frames directly to supported microcontrollers.",
    readyAction: "Connect hardware from Tactile Lab on Chrome or Edge.",
  },
  {
    id: "web-hid",
    label: "WebHID",
    help: "Sends frames to HID-class tactile or braille devices.",
    readyAction: "Use a Chromium browser and connect the device in Tactile Lab.",
  },
  {
    id: "service-worker",
    label: "Service worker",
    help: "Keeps the app shell available offline after install.",
    readyAction: "Install the app, then check offline readiness below.",
  },
  {
    id: "cache-storage",
    label: "Offline storage",
    help: "Stores app files and braille tables for offline use.",
    readyAction: "Cache language tables before going offline.",
  },
];

function DeviceCapabilitiesPanel() {
  const rows = useMemo(
    () =>
      CAPABILITY_ROWS.map((row) => ({
        ...row,
        report: detectCapability(row.id),
      })),
    []
  );
  const supported = rows.filter((row) => row.report.available).length;

  return (
    <Panel
      id="device-capabilities"
      title="Device capabilities"
      description={`${supported} of ${rows.length} capabilities are available in this browser. Each row includes the next useful action.`}
      icon={<span className="text-sky-300"><DeviceIcon /></span>}
      accent="bg-sky-500/10 border-sky-400/30"
    >
      <ul className="space-y-2" aria-label="Device capability diagnostics">
        {rows.map((row) => (
          <CapabilityRow
            key={row.id}
            label={row.label}
            help={row.help}
            readyAction={row.readyAction}
            report={row.report}
          />
        ))}
      </ul>
    </Panel>
  );
}

function CapabilityRow({
  label,
  help,
  readyAction,
  report,
}: {
  label: string;
  help: string;
  readyAction: string;
  report: CapabilityReport;
}) {
  const dot = report.available ? "bg-emerald-400 text-emerald-400" : "bg-amber-400 text-amber-400";
  const copy = report.available ? "Available" : "Needs fallback";
  const copyClass = report.available ? "text-emerald-300" : "text-amber-300";
  const action = report.available ? readyAction : report.suggestion;

  return (
    <li
      className="surface-card border border-surface-border rounded-xl p-3"
      aria-label={`${label}: ${copy}. ${help} Next action: ${action}`}
    >
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className={`mt-1.5 inline-block w-2.5 h-2.5 rounded-full ${dot} shadow-[0_0_8px_currentColor]`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <span className="text-stone-50 font-medium">{label}</span>
            <span className={`text-sm ${copyClass}`}>{copy}</span>
          </div>
          <p className="text-xs text-stone-400 mt-1 leading-relaxed">{help}</p>
          {!report.available && (
            <p className="text-xs text-amber-200 mt-2 leading-relaxed">
              {report.reason}
            </p>
          )}
          <p className="text-xs text-stone-300 mt-2 leading-relaxed">
            <span className="font-medium text-stone-100">Next:</span> {action}
          </p>
        </div>
      </div>
    </li>
  );
}

function SetupPanel({
  setupStatus,
  onRestart,
  onTroubleshoot,
}: {
  setupStatus: import("@/core/store/settingsStore").SetupStatus;
  onRestart: () => void;
  onTroubleshoot: () => void;
}) {
  const rows = [
    {
      label: "Camera access",
      state: setupStatus.camera,
      hint: "Powers AI Vision scene descriptions.",
    },
    {
      label: "Microphone access",
      state: setupStatus.microphone,
      hint: "Powers Voice Navigation and the F6 hotkey.",
    },
    {
      label: "Voice selected",
      state: (setupStatus.voiceConfirmed ? "granted" : "unknown") as
        | "granted"
        | "unknown"
        | "denied",
      hint: "Confirm the speech voice or accept system default.",
    },
  ];
  const allReady =
    setupStatus.camera === "granted" &&
    setupStatus.microphone === "granted" &&
    setupStatus.voiceConfirmed;
  return (
    <Panel
      id="setup"
      title="Setup"
      description={
        allReady
          ? "Everything's configured. Run setup again any time to revisit."
          : "Some setup items aren't complete. You can finish them any time."
      }
      icon={<span className="text-yellow-300"><SetupIcon /></span>}
      accent="bg-yellow-500/10 border-yellow-400/30"
    >
      <ul className="space-y-2 mb-4" aria-label="Setup status">
        {rows.map((row) => (
          <SetupRow key={row.label} {...row} />
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          onClick={onRestart}
          aria-label="Re-open setup to grant permissions or change voice"
          data-testid="restart-setup"
          className="w-full sm:w-auto"
        >
          Run setup again
        </Button>
        <Button
          variant="ghost"
          onClick={onTroubleshoot}
          aria-label="Open the troubleshoot page to see capability details for this device"
          data-testid="open-troubleshoot"
          className="w-full sm:w-auto"
        >
          Troubleshoot
        </Button>
      </div>
    </Panel>
  );
}

function SetupRow({
  label,
  state,
  hint,
}: {
  label: string;
  state: "granted" | "denied" | "unknown";
  hint: string;
}) {
  const styles =
    state === "granted"
      ? { dot: "bg-emerald-400 text-emerald-400", copy: "Ready", copyClass: "text-emerald-300" }
      : state === "denied"
        ? { dot: "bg-rose-400 text-rose-400", copy: "Blocked", copyClass: "text-rose-300" }
        : { dot: "bg-stone-500 text-stone-500", copy: "Not set", copyClass: "text-stone-400" };
  return (
    <li
      className="flex items-start gap-3 surface-card border border-surface-border rounded-xl p-3"
      aria-label={`${label}: ${styles.copy}. ${hint}`}
    >
      <span
        aria-hidden="true"
        className={`mt-1.5 inline-block w-2.5 h-2.5 rounded-full ${styles.dot} shadow-[0_0_8px_currentColor]`}
      />
      <div className="flex-1 min-w-0" aria-hidden="true">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-stone-50 font-medium">{label}</span>
          <span className={`text-sm ${styles.copyClass}`}>{styles.copy}</span>
        </div>
        <p className="text-xs text-stone-500 mt-1 leading-relaxed">{hint}</p>
      </div>
    </li>
  );
}

function PrivacyPanel({
  onClearLocalData,
  clearMessage,
  visionRetainHistory,
  onSetVisionRetainHistory,
  persistImportedText,
  onSetPersistImportedText,
}: {
  onClearLocalData: () => void;
  clearMessage: string;
  visionRetainHistory: boolean;
  onSetVisionRetainHistory: (enabled: boolean) => void;
  persistImportedText: boolean;
  onSetPersistImportedText: (enabled: boolean) => void;
}) {
  return (
    <Panel
      id="privacy"
      title="Privacy & data"
      description="Every place this app touches your data. Tap a row to read the full explanation."
      icon={<span className="text-rose-300"><LockIcon /></span>}
      accent="bg-rose-500/10 border-rose-400/30"
    >
      <div className="mb-4 pb-4 border-b border-surface-border">
        <div className="space-y-2">
          <ToggleRow
            checked={visionRetainHistory}
            onChange={onSetVisionRetainHistory}
            label="Keep AI Vision history this session"
            hint="When off, only the most recent description is kept in memory. History never leaves your device."
          />
          <ToggleRow
            checked={persistImportedText}
            onChange={onSetPersistImportedText}
            label="Remember Tactile Lab imports across restarts"
            hint="Off by default. When off, clipboard, file, and Reader text stay only in this tab session."
          />
        </div>
      </div>
      <ul className="space-y-2" aria-label="Privacy disclosures">
        {DISCLOSURES.map((d) => (
          <DisclosureRow key={d.id} disclosure={d} />
        ))}
      </ul>
      <div className="mt-5 pt-4 border-t border-surface-border">
        <Button
          variant="secondary"
          onClick={onClearLocalData}
          aria-label="Reset every saved setting and clear all locally stored app data"
          data-testid="clear-local-data"
        >
          Clear saved data
        </Button>
        <p className="text-xs text-stone-400 mt-3 leading-relaxed">
          Resets translator/language/output choices, imported text, drill history, voice and display preferences. Onboarding stays marked complete so you don't get sent back to the welcome flow.
        </p>
        {clearMessage && (
          <p className="text-xs text-emerald-300 mt-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-400/20" role="status" aria-live="polite">
            {clearMessage}
          </p>
        )}
      </div>
    </Panel>
  );
}

function DisclosureRow({ disclosure }: { disclosure: Disclosure }) {
  const chipClasses = SCOPE_CLASSES[disclosure.scope];
  const chipLabel = SCOPE_LABELS[disclosure.scope];
  return (
    <li className="surface-card border border-surface-border rounded-xl overflow-hidden">
      <details className="group">
        <summary
          className="min-h-touch px-4 py-3 cursor-pointer flex items-start justify-between gap-3 list-none hover:bg-white/[0.02] focus-visible:ring-2 focus-visible:ring-primary-400 transition-colors"
          aria-label={`${disclosure.title}, stored ${chipLabel}. ${disclosure.summary}. Expand for full details.`}
        >
          <div className="flex-1 min-w-0" aria-hidden="true">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-stone-50 font-medium">{disclosure.title}</span>
              <span
                className={`text-xs border rounded-full px-2 py-0.5 whitespace-nowrap ${chipClasses}`}
              >
                {chipLabel}
              </span>
            </div>
            <p className="text-sm text-stone-300/80 mt-1">{disclosure.summary}</p>
          </div>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-4 h-4 mt-1 text-stone-500 group-open:rotate-90 transition-transform"
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </summary>
        <p className="px-4 pb-4 pt-1 text-sm text-stone-300 leading-relaxed border-t border-surface-border/60">
          {disclosure.detail}
        </p>
      </details>
    </li>
  );
}

function OfflineReadinessPanel({
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
    <Panel
      id="offline"
      title="Offline readiness"
      description="What's cached right now. After install + first use, items switch to cached."
      icon={<span className="text-emerald-300"><CloudIcon /></span>}
      accent="bg-emerald-500/10 border-emerald-400/30"
    >
      {report && !report.cacheApiAvailable && (
        <p role="alert" className="text-sm text-amber-200 mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-400/20">
          The Cache Storage API isn't available in this context. Install the PWA, or run over HTTPS / localhost to enable the service worker.
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
              help="Entry table plus required includes for offline Grade 2 translation."
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
        <span className="text-xs text-stone-500" aria-live="polite">
          {report ? `Last checked ${formatRelativeTime(report.checkedAt)}` : ""}
        </span>
      </div>
      {precacheMessage && (
        <p className="text-xs text-stone-300 mt-3 px-3 py-2 rounded-lg bg-surface-2 border border-surface-border" role="status" aria-live="polite">
          {precacheMessage}
        </p>
      )}
    </Panel>
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
  const { dot, copy, copyClass } = renderStatus(status);
  return (
    <li
      className="flex items-start gap-3 surface-card border border-surface-border rounded-xl p-3"
      aria-label={`${label}: ${copy}. ${help}`}
    >
      <span aria-hidden="true" className={`mt-1.5 inline-block w-2.5 h-2.5 rounded-full ${dot} shadow-[0_0_8px_currentColor]`} />
      <div className="flex-1 min-w-0" aria-hidden="true">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <span className="text-stone-50 font-medium">{label}</span>
          <span className={`text-sm ${copyClass}`}>{copy}</span>
        </div>
        <p className="text-xs text-stone-500 mt-1 leading-relaxed">{help}</p>
      </div>
    </li>
  );
}

function renderStatus(status: Status): { dot: string; copy: string; copyClass: string } {
  if (status === "cached") {
    return { dot: "bg-emerald-400 text-emerald-400", copy: "Cached", copyClass: "text-emerald-300" };
  }
  if (status === "missing") {
    return { dot: "bg-amber-400 text-amber-400", copy: "Not cached yet", copyClass: "text-amber-300/90" };
  }
  return { dot: "bg-stone-500 text-stone-500", copy: "Unknown", copyClass: "text-stone-400" };
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
