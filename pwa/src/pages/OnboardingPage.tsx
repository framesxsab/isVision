
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { useSettingsStore } from "@/core/store/settingsStore";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { platform } from "@/core/utils/platform";

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

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [audioStarted, setAudioStarted] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(null);
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const [liveMessage, setLiveMessage] = useState(
    "Setup loaded. Start spoken setup is focused."
  );
  const firstActionRef = useRef<HTMLButtonElement | null>(null);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const setVoiceURI = useSettingsStore((s) => s.setVoiceURI);
  const voiceURI = useSettingsStore((s) => s.voiceURI);

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
    navigate("/");
  }, [completeOnboarding, navigate]);

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
      announce("Camera access granted.");
    } catch {
      setCameraGranted(false);
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
      announce("Microphone access granted.");
    } catch {
      setMicGranted(false);
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
      completeOnboarding();
      navigate("/");
    } else {
      setStep((s) => s + 1);
    }
  };

  if (!audioStarted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8 max-w-lg mx-auto">
        <div className="sr-only" role="status" aria-live="assertive">
          {liveMessage}
        </div>

        <div className="text-center mb-8">
          <p className="text-sm uppercase text-primary-200 mb-3">
            Audio-first setup
          </p>
          <h1 className="text-3xl font-bold text-stone-50 mb-4">isVisible setup</h1>
          <p className="text-lg text-stone-300 leading-relaxed">
            Start spoken setup to continue with voice guidance. Setup can also
            be skipped and changed later from Settings.
          </p>
        </div>

        <div className="w-full space-y-3">
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
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8 max-w-lg mx-auto">
      <div className="sr-only" role="status" aria-live="assertive">
        {liveMessage}
      </div>

      <div
        className="flex gap-2 mb-8"
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
            className={`h-2 w-12 rounded-full transition-colors ${
              i <= step ? "bg-primary-400" : "bg-stone-700"
            }`}
          />
        ))}
      </div>

      <div className="text-center mb-8">
        <p className="text-sm text-primary-200 mb-2">
          Step {step + 1} of {steps.length}
        </p>
        <h1 className="text-2xl font-bold text-stone-50 mb-4">{currentStep.title}</h1>
        <p className="text-lg text-stone-300 leading-relaxed">{currentStep.description}</p>
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
              announce("This is how I sound.");
            }}
            className="w-full min-h-touch bg-stone-950 text-stone-50 border border-stone-700 rounded-lg px-4 py-3"
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
        <p className="text-amber-300 text-sm mb-4" role="status">
          Haptic feedback is not available on this device. Audio feedback will be used instead.
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
        <Button onClick={handleSkip} variant="ghost" className="w-full">
          Skip setup
        </Button>
      </div>
    </div>
  );
}
