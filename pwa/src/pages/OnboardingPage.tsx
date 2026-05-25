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
    title: "AI Vision",
    description:
      "Point your camera at anything — signs, documents, scenes, products. AI will describe what it sees in detail.",
    speech:
      "AI Vision uses your camera. Point it at anything and I'll describe what I see. Signs, documents, scenes, anything.",
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

  const currentStep = steps[step]!;
  const isLast = step === steps.length - 1;

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
