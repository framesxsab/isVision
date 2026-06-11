
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/Button";
import { useSettingsStore } from "@/core/store/settingsStore";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { platform } from "@/core/utils/platform";
import { queryMediaPermission } from "@/core/utils/capabilities";

const steps = [
  {
    title: "Welcome to isVisible",
    description:
      "An accessibility platform that lets you touch, hear, and navigate the visual world. Built for blind and visually impaired users.",
    speech:
      "Welcome to isVisible. I am your accessibility assistant. This setup is audio guided. I will move focus to the next control for you.",
  },
  {
    title: "Touch Explorer",
    description:
      "Slide your finger across the screen to hear what's there. Buttons, links, headings, and page sections can speak with sound and vibration feedback.",
    speech:
      "Touch Explorer lets you slide your finger across the screen. Each element you touch is spoken aloud with haptic feedback when your device supports vibration.",
  },
  {
    title: "Permissions",
    description:
      "Camera access powers AI Vision. Microphone access powers Voice Navigation. Both are optional and can be granted later.",
    speech:
      "Camera and microphone access are optional. Use the camera button for AI Vision, or the microphone button for Voice Navigation. Your browser will ask you to allow or block each permission.",
  },
  {
    title: "Voice",
    description:
      "Choose the speech voice used by the app. The system default is selected unless you choose a different voice.",
    speech:
      "Choose the speech voice used by the app. The system default is already selected. Move to the list if you want another voice.",
  },
];

const SHORTCUT_HELP =
  "Press Enter for the focused action. Press R to repeat this guidance. Press S to skip setup.";

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return (
    tagName === "input" ||
    tagName === "select" ||
    tagName === "textarea" ||
    target.isContentEditable
  );
}

function BrandMark() {
  return (
    <div
      aria-hidden="true"
      className="relative mx-auto mb-6 w-20 h-20 rounded-2xl flex items-center justify-center
                 bg-gradient-to-br from-primary-400/25 via-primary-500/10 to-yellow-500/15
                 border border-primary-400/30
                 shadow-[0_10px_40px_-12px_rgba(251,146,60,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]"
    >
      <span className="absolute inset-0 rounded-2xl bg-primary-400/10 blur-xl -z-10" />
      <svg viewBox="0 0 48 48" className="w-10 h-10 text-primary-200" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="24" cy="24" r="6" />
        <path d="M4 24c4-8 11-13 20-13s16 5 20 13c-4 8-11 13-20 13S8 32 4 24z" />
      </svg>
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const isRestart = params.get("restart") === "1";
  const nextPath = readNextPath(params.get("next"));
  const [step, setStep] = useState(0);
  // Skip the audio-gate splash on restart — returning users have already
  // tapped past it once and shouldn't be forced through it again.
  const [audioStarted, setAudioStarted] = useState(isRestart);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const setupStatus = useSettingsStore((s) => s.setupStatus);
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(
    setupStatus.camera === "unknown" ? null : setupStatus.camera === "granted"
  );
  const [micGranted, setMicGranted] = useState<boolean | null>(
    setupStatus.microphone === "unknown" ? null : setupStatus.microphone === "granted"
  );
  const [liveMessage, setLiveMessage] = useState(
    isRestart
      ? "Setup re-opened. You can change permissions and voice here."
      : "Setup loaded. Start spoken setup is focused."
  );
  const firstActionRef = useRef<HTMLButtonElement | null>(null);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const setVoiceURI = useSettingsStore((s) => s.setVoiceURI);
  const voiceURI = useSettingsStore((s) => s.voiceURI);
  const setSetupStatus = useSettingsStore((s) => s.setSetupStatus);

  useEffect(() => {
    let cancelled = false;
    async function refreshPermissionStatus() {
      const [camera, microphone] = await Promise.all([
        queryMediaPermission("camera"),
        queryMediaPermission("microphone"),
      ]);
      if (cancelled) return;

      const patch = {
        ...(camera ? { camera } : {}),
        ...(microphone ? { microphone } : {}),
      };
      if (camera) setCameraGranted(camera === "granted" ? true : camera === "denied" ? false : null);
      if (microphone) {
        setMicGranted(microphone === "granted" ? true : microphone === "denied" ? false : null);
      }
      setSetupStatus(patch);
    }

    void refreshPermissionStatus();
    return () => {
      cancelled = true;
    };
  }, [setSetupStatus]);

  const announce = useCallback((message: string) => {
    setLiveMessage(message);
    speechEngine.interrupt(message);
  }, []);

  useEffect(() => {
    speechEngine.init();
    const loadVoices = () => setVoices(speechEngine.getVoices());
    loadVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () =>
      window.speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => firstActionRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [audioStarted, step]);

  const repeatCurrentStep = useCallback(() => {
    const currentStep = steps[step] ?? steps[0]!;
    announce(`${currentStep.speech} ${SHORTCUT_HELP}`);
  }, [announce, step]);

  useEffect(() => {
    if (audioStarted) {
      repeatCurrentStep();
    }
  }, [audioStarted, repeatCurrentStep]);

  const handleSkip = useCallback(() => {
    speechEngine.stop();
    completeOnboarding();
    navigate(nextPath, { replace: true });
  }, [completeOnboarding, navigate, nextPath]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;

      if (!audioStarted && event.key === "Enter") {
        event.preventDefault();
        setAudioStarted(true);
        return;
      }

      if (!audioStarted) return;

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        repeatCurrentStep();
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSkip();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [audioStarted, handleSkip, repeatCurrentStep]);

  const requestCamera = async () => {
    announce(
      "Opening the camera permission prompt. Choose Allow if you want AI Vision to describe what the camera sees."
    );
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setCameraGranted(true);
      setSetupStatus({ camera: "granted" });
      announce("Camera access granted.");
    } catch {
      setCameraGranted(false);
      setSetupStatus({ camera: "denied" });
      announce("Camera access was not granted. AI Vision can ask again later.");
    }
  };

  const requestMic = async () => {
    announce(
      "Opening the microphone permission prompt. Choose Allow if you want hands-free voice navigation."
    );
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicGranted(true);
      setSetupStatus({ microphone: "granted" });
      announce("Microphone access granted.");
    } catch {
      setMicGranted(false);
      setSetupStatus({ microphone: "denied" });
      announce("Microphone access was not granted. Voice Navigation can ask again later.");
    }
  };

  const currentStep = steps[step]!;
  const isLast = step === steps.length - 1;
  const isPermissionsStep = step === 2;

  const handleNext = () => {
    if (!audioStarted) {
      setAudioStarted(true);
      return;
    }

    if (isLast) {
      announce("Setup complete. Opening the home screen.");
      // Treat reaching the end as voice-confirmation — either the user explicitly
      // picked a voice or accepted system default, both are intentional choices.
      setSetupStatus({ voiceConfirmed: true });
      completeOnboarding();
      navigate(nextPath, { replace: true });
    } else {
      setStep((s) => s + 1);
    }
  };

  const finishLater = useCallback(() => {
    // "Finish later" — let the user out without forcing remaining steps,
    // but keep the partial setupStatus so Settings + module pages can
    // remind them what's still pending.
    speechEngine.stop();
    announce("Setup paused. You can finish it any time from Settings.");
    completeOnboarding();
    navigate(nextPath, { replace: true });
  }, [announce, completeOnboarding, navigate, nextPath]);

  if (!audioStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8 max-w-lg mx-auto">
        <div className="sr-only" role="status" aria-live="polite">
          {liveMessage}
        </div>

        <div className="text-center mb-10 animate-fade-up">
          <BrandMark />
          <p className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] font-semibold px-3 py-1 rounded-full bg-primary-500/10 text-primary-200 border border-primary-400/25 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-300 animate-pulse-soft" />
            Audio-first setup
          </p>
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            <span className="text-stone-50">is</span>
            <span className="text-gradient-warm">Visible</span>
          </h1>
          <p className="text-lg text-stone-300 leading-relaxed max-w-md mx-auto">
            Start spoken setup to continue with voice guidance, or skip and configure later from Settings.
          </p>
        </div>

        <div className="w-full space-y-3 animate-fade-up">
          <Button
            ref={firstActionRef}
            onClick={handleNext}
            size="lg"
            className="w-full"
            aria-describedby="spoken-setup-hint"
          >
            Start spoken setup
          </Button>
          <p id="spoken-setup-hint" className="sr-only">
            This turns on spoken guidance and moves focus to each setup control.
          </p>
          <Button onClick={handleSkip} variant="ghost" className="w-full">
            Skip setup
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 max-w-lg mx-auto">
      <div className="sr-only" role="status" aria-live="polite">
        {liveMessage}
      </div>

      {/* Step counter + progress dots */}
      <div className="w-full mb-8 animate-fade-up">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs uppercase tracking-[0.18em] font-semibold text-primary-300">
            Step {step + 1} of {steps.length}
          </span>
          <button
            onClick={handleSkip}
            className="text-xs uppercase tracking-[0.16em] font-semibold text-stone-400 hover:text-stone-200 transition-colors px-2 py-1 rounded"
            aria-label="Skip setup"
          >
            Skip
          </button>
        </div>
        <div
          className="flex gap-1.5"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={step + 1}
          aria-label={`Step ${step + 1} of ${steps.length}: ${currentStep.title}`}
        >
          {steps.map((_, i) => (
            <div
              key={i}
              aria-hidden="true"
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i < step
                  ? "bg-primary-400"
                  : i === step
                    ? "bg-primary-400 shadow-[0_0_12px_rgba(251,146,60,0.5)]"
                    : "bg-surface-3"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="text-center mb-10 animate-fade-up">
        <BrandMark />
        <h1 className="text-3xl font-bold text-stone-50 mb-4 tracking-tight">{currentStep.title}</h1>
        <p className="text-lg text-stone-300/90 leading-relaxed">{currentStep.description}</p>
      </div>

      {isPermissionsStep && (
        <div className="w-full space-y-3 mb-8">
          <Button
            ref={firstActionRef}
            onClick={requestCamera}
            variant={cameraGranted === true ? "primary" : "secondary"}
            className="w-full"
            disabled={cameraGranted === true}
          >
            {cameraGranted === true
              ? "Camera granted"
              : cameraGranted === false
                ? "Camera not granted. Try again"
                : "Grant camera access"}
          </Button>
          <Button
            onClick={requestMic}
            variant={micGranted === true ? "primary" : "secondary"}
            className="w-full"
            disabled={micGranted === true}
          >
            {micGranted === true
              ? "Microphone granted"
              : micGranted === false
                ? "Microphone not granted. Try again"
                : "Grant microphone access"}
          </Button>
        </div>
      )}

      {isLast && (
        <div className="w-full mb-8">
          <label htmlFor="onboard-voice" className="block text-sm text-stone-300 mb-2 text-center">
            Select a voice
          </label>
          <select
            id="onboard-voice"
            value={voiceURI ?? ""}
            onChange={(e) => {
              const uri = e.target.value || null;
              setVoiceURI(uri);
              speechEngine.setVoice(uri);
              setSetupStatus({ voiceConfirmed: true });
              announce("This is how I sound.");
            }}
            className="w-full min-h-touch bg-surface-2 text-stone-50 border border-surface-border rounded-xl px-4 py-3 focus:border-primary-400/60 transition-colors"
          >
            <option value="">System default</option>
            {voices.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang})
              </option>
            ))}
          </select>
        </div>
      )}

      {step === 1 && !platform.supportsVibration && (
        <p className="text-amber-300 text-sm mb-4 px-4 py-2 rounded-lg bg-amber-500/10 border border-amber-400/20" role="status">
          Haptic feedback isn't available on this device. Audio feedback will be used instead.
        </p>
      )}

      <p className="sr-only" id="setup-shortcuts">
        {SHORTCUT_HELP}
      </p>

      <div className="w-full space-y-3">
        {!isPermissionsStep && (
          <Button
            ref={firstActionRef}
            onClick={handleNext}
            size="lg"
            className="w-full"
            aria-describedby="setup-shortcuts"
          >
            {isLast ? "Get started" : "Next"}
          </Button>
        )}
        {isPermissionsStep && (
          <Button onClick={handleNext} size="lg" className="w-full">
            Continue
          </Button>
        )}
        <Button onClick={repeatCurrentStep} variant="secondary" className="w-full">
          Repeat guidance
        </Button>
        {isPermissionsStep && (
          <button
            type="button"
            onClick={finishLater}
            className="w-full min-h-touch text-sm text-stone-400 hover:text-stone-200 transition-colors py-2 rounded focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
          >
            Finish later
          </button>
        )}
      </div>
    </div>
  );
}

function readNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}
