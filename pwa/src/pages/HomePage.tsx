import { useNavigate } from "react-router-dom";
import { Card } from "@/components/Card";
import {
  IconBook,
  IconBraille,
  IconCamera,
  IconMicrophone,
  IconSettings,
  IconTarget,
  IconTouch,
} from "@/components/Icons";
import { useSettingsStore } from "@/core/store/settingsStore";
import { useInstallPrompt } from "@/core/hooks/useInstallPrompt";
import { Button } from "@/components/Button";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

interface ModuleInfo {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  path: string;
}

const modules: ModuleInfo[] = [
  {
    id: "touch-explorer",
    title: "Touch Explorer",
    description: "Hear buttons, links, and headings as you touch.",
    icon: <IconTouch className="w-6 h-6 text-primary-300" />,
    path: "/touch-explorer",
  },
  {
    id: "ai-vision",
    title: "AI Vision",
    description: "Camera capture with spoken scene descriptions.",
    icon: <IconCamera className="w-6 h-6 text-primary-300" />,
    path: "/ai-vision",
  },
  {
    id: "reader",
    title: "Accessible Reader",
    description: "Clean article reading from a pasted URL.",
    icon: <IconBook className="w-6 h-6 text-primary-300" />,
    path: "/reader",
  },
  {
    id: "voice-nav",
    title: "Voice Navigation",
    description: "Hands-free commands for core navigation.",
    icon: <IconMicrophone className="w-6 h-6 text-primary-300" />,
    path: "/voice-nav",
  },
  {
    id: "tactile-output",
    title: "Tactile Output Lab",
    description: "Convert text into braille frame output.",
    icon: <IconBraille className="w-6 h-6 text-primary-300" />,
    path: "/tactile-output",
  },
  {
    id: "tactile-drill",
    title: "Tactile Drill",
    description: "Practice braille prompts and track accuracy.",
    icon: <IconTarget className="w-6 h-6 text-primary-300" />,
    path: "/tactile-drill",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  const { canInstall, install } = useInstallPrompt();
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (!onboardingComplete) {
      navigate("/onboarding");
    }
  }, [onboardingComplete, navigate]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setHint("Tip: press F6 at any time to give a voice command.");
    }, 1200);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="min-h-screen px-4 py-6 max-w-4xl mx-auto">
      <header className="mb-6 border-b border-stone-700/80 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-stone-50">isVisible</h1>
            <p className="text-stone-300 mt-2 text-base">
              Touch, hear, and navigate the visual world.
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={() => navigate("/settings")}
            aria-label="Open settings"
            className="shrink-0"
          >
            <IconSettings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <section aria-labelledby="modules-heading">
        <h2 id="modules-heading" className="text-sm font-semibold uppercase text-primary-200 mb-3">
          Workspace
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {modules.map((mod) => (
            <Card
              key={mod.id}
              title={mod.title}
              description={mod.description}
              icon={mod.icon}
              onClick={() => navigate(mod.path)}
            />
          ))}
        </div>
      </section>

      {/* Install prompt */}
      {canInstall && (
        <section aria-label="Install app" className="mt-6 border-t border-stone-700/80 pt-5">
          <Button onClick={install} size="lg" className="w-full">
            Install isVisible on your device
          </Button>
        </section>
      )}

      <p role="status" aria-live="polite" className="sr-only">{hint}</p>
    </div>
  );
}
