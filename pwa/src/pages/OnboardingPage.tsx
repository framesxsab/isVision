import { useState, useEffect } from "react";
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
      "Welcome to isVisible. I am your accessibility assistant. Let me walk you through what I can do.",
  },
  {
    title: "Touch Explorer",
    description:
      "Slide your finger across the screen to hear what's there. Buttons, links, headings — everything speaks to you with different sounds and vibrations.",
    speech:
      "Touch Explorer lets you slide your finger across the screen. Each element you touch will be spoken aloud with haptic feedback.",
  },
  {
    title: "Grant Permissions",
    description:
      "isVisible needs access to your camera (for AI Vision) and microphone (for Voice Navigation). You can deny these now and grant them later.",
    speech:
      "I need your permission to use the camera and microphone. Tap the buttons below to grant access. You can skip this if you prefer.",
  },
  {
    title: "Choose Your Voice",
    description:
      "Pick a voice that you find clear and comfortable. You can always change this in settings.",
    speech: "Pick a voice you like. You can change it anytime in settings.",
  },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [cameraGranted, setCameraGranted] = useState<boolean | null>(null);
  const [micGranted, setMicGranted] = useState<boolean | null>(null);
  const completeOnboarding = useSettingsStore((s) => s.completeOnboarding);
  const setVoiceURI = useSettingsStore((s) => s.setVoiceURI);
  const voiceURI = useSettingsStore((s) => s.voiceURI);

  useEffect(() => {
    speechEngine.init();
    const loadVoices = () => setVoices(speechEngine.getVoices());
    loadVoices();
    speechSynthesis?.addEventListener("voiceschanged", loadVoices);
    return () => speechSynthesis?.removeEventListener("voiceschanged", loadVoices);
  }, []);

  useEffect(() => {
    const currentStep = steps[step];
    if (currentStep) {
      speechEngine.interrupt(currentStep.speech);
    }
  }, [step]);

  const requestCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop()); // Release immediately
      setCameraGranted(true);
      speechEngine.interrupt("Camera access granted.");
    } catch {
      setCameraGranted(false);
      speechEngine.interrupt("Camera access denied. You can grant it later in your browser settings.");
    }
  };

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      setMicGranted(true);
      speechEngine.interrupt("Microphone access granted.");
    } catch {
      setMicGranted(false);
      speechEngine.interrupt("Microphone access denied. You can grant it later in your browser settings.");
    }
  };

  const currentStep = steps[step]!;
  const isLast = step === steps.length - 1;
  const isPermissionsStep = step === 2;

  const handleNext = () => {
    if (isLast) {
      speechEngine.interrupt("Setup complete. Let's get started!");
      completeOnboarding();
      navigate("/");
    } else {
      setStep((s) => s + 1);
    }
  };

  const handleSkip = () => {
    speechEngine.stop();
    completeOnboarding();
    navigate("/");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-8 max-w-lg mx-auto">
      {/* Progress */}
      <div className="flex gap-2 mb-8" role="progressbar" aria-valuemin={1} aria-valuemax={steps.length} aria-valuenow={step + 1} aria-label={`Step ${step + 1} of ${steps.length}`}>
        {steps.map((_, i) => (
          <div
            key={i}
            className={`h-2 w-12 rounded-full transition-colors ${
              i <= step ? "bg-primary-500" : "bg-gray-700"
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-white mb-4">{currentStep.title}</h1>
        <p className="text-lg text-gray-300 leading-relaxed">{currentStep.description}</p>
      </div>

      {/* Permissions step */}
      {isPermissionsStep && (
        <div className="w-full space-y-3 mb-8">
          <Button
            onClick={requestCamera}
            variant={cameraGranted === true ? "primary" : "secondary"}
            className="w-full"
            disabled={cameraGranted === true}
          >
            {cameraGranted === true
              ? "Camera granted"
              : cameraGranted === false
                ? "Camera denied — tap to retry"
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
                ? "Microphone denied — tap to retry"
                : "Grant microphone access"}
          </Button>
        </div>
      )}

      {/* Voice picker on last step */}
      {isLast && (
        <div className="w-full mb-8">
          <label htmlFor="onboard-voice" className="block text-sm text-gray-300 mb-2 text-center">
            Select a voice
          </label>
          <select
            id="onboard-voice"
            value={voiceURI ?? ""}
            onChange={(e) => {
              const uri = e.target.value || null;
              setVoiceURI(uri);
              speechEngine.setVoice(uri);
              speechEngine.interrupt("This is how I sound.");
            }}
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
      )}

      {/* Feature info */}
      {step === 1 && !platform.supportsVibration && (
        <p className="text-yellow-400 text-sm mb-4">
          Note: Haptic feedback is not available on this device. Audio feedback will be used instead.
        </p>
      )}

      {/* Navigation */}
      <div className="w-full space-y-3">
        <Button onClick={handleNext} size="lg" className="w-full">
          {isLast ? "Get Started" : "Next"}
        </Button>
        <Button onClick={handleSkip} variant="ghost" className="w-full">
          Skip setup
        </Button>
      </div>
    </div>
  );
}
