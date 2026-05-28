import { useNavigate } from "react-router-dom";
import { Card, type CardAccent } from "@/components/Card";
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
  accent: CardAccent;
  meta: string;
}

const modules: ModuleInfo[] = [
  {
    id: "touch-explorer",
    title: "Touch Explorer",
    description: "Slide your finger and hear what's on screen — buttons, links, and headings.",
    icon: <IconTouch className="w-6 h-6" />,
    path: "/touch-explorer",
    accent: "cyan",
    meta: "Touch + haptics",
  },
  {
    id: "ai-vision",
    title: "AI Vision",
    description: "Point the camera at anything. Hear an instant spoken scene description.",
    icon: <IconCamera className="w-6 h-6" />,
    path: "/ai-vision",
    accent: "violet",
    meta: "Camera + AI",
  },
  {
    id: "reader",
    title: "Accessible Reader",
    description: "Paste any URL. Get a clean, distraction-free article read aloud.",
    icon: <IconBook className="w-6 h-6" />,
    path: "/reader",
    accent: "amber",
    meta: "Read aloud",
  },
  {
    id: "voice-nav",
    title: "Voice Navigation",
    description: "Hands-free commands across the whole app. Just speak.",
    icon: <IconMicrophone className="w-6 h-6" />,
    path: "/voice-nav",
    accent: "emerald",
    meta: "Hands-free",
  },
  {
    id: "tactile-output",
    title: "Tactile Output Lab",
    description: "Convert text into braille frames for hardware refreshable displays.",
    icon: <IconBraille className="w-6 h-6" />,
    path: "/tactile-output",
    accent: "rose",
    meta: "Braille",
  },
  {
    id: "tactile-drill",
    title: "Tactile Drill",
    description: "Practice letters, words, and numbers in braille. Track your accuracy.",
    icon: <IconTarget className="w-6 h-6" />,
    path: "/tactile-drill",
    accent: "indigo",
    meta: "Practice",
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
    <div className="min-h-screen px-4 sm:px-6 py-6 sm:py-8 max-w-4xl mx-auto">
      {/* Hero — brand wordmark with subtle dot accent and a status chip */}
      <header className="mb-7 sm:mb-9 animate-fade-up">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 mb-3">
              <span
                aria-hidden="true"
                className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] font-semibold px-2.5 py-1 rounded-full bg-primary-500/10 text-primary-200 border border-primary-400/25"
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary-300 opacity-75 animate-pulse-soft" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-300" />
                </span>
                Accessibility platform
              </span>
            </div>
            <h1 className="text-[2.25rem] sm:text-5xl font-bold tracking-tight leading-[1.05]">
              <span className="text-stone-50">is</span>
              <span className="text-gradient-cyan">Visible</span>
              <span aria-hidden="true" className="inline-block ml-1 align-baseline w-2 h-2 rounded-full bg-primary-400 shadow-[0_0_18px_rgba(34,211,238,0.7)]" />
            </h1>
            <p className="text-stone-300/90 mt-3 text-base sm:text-lg leading-relaxed max-w-xl">
              Touch, hear, and navigate the visual world.{" "}
              <span className="text-stone-400">Built for blind and low-vision users.</span>
            </p>
          </div>
          <button
            onClick={() => navigate("/settings")}
            aria-label="Open settings"
            className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full bg-surface-2 border border-surface-border text-stone-300 hover:text-stone-50 hover:bg-surface-3 transition-colors focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0"
          >
            <IconSettings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Hint card — quick affordance for F6 voice hotkey */}
      <div
        aria-hidden="true"
        className="mb-6 sm:mb-7 flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-1/70 border border-surface-border/80 backdrop-blur"
      >
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary-500/15 border border-primary-400/25 text-primary-300">
          <IconMicrophone className="w-4 h-4" />
        </span>
        <p className="text-sm text-stone-300 flex-1">
          Press <kbd className="px-1.5 py-0.5 rounded-md bg-surface-3 border border-surface-border text-xs font-mono text-stone-100">F6</kbd> anywhere to give a voice command.
        </p>
      </div>

      <section aria-labelledby="modules-heading" className="animate-fade-up">
        <div className="flex items-baseline justify-between mb-4">
          <h2
            id="modules-heading"
            className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400"
          >
            Workspace
          </h2>
          <span className="text-xs text-stone-500" aria-hidden="true">
            {modules.length} modules
          </span>
        </div>
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          {modules.map((mod) => (
            <Card
              key={mod.id}
              title={mod.title}
              description={mod.description}
              icon={mod.icon}
              accent={mod.accent}
              meta={mod.meta}
              onClick={() => navigate(mod.path)}
            />
          ))}
        </div>
      </section>

      {/* Install prompt */}
      {canInstall && (
        <section
          aria-label="Install app"
          className="mt-8 p-5 rounded-2xl surface-panel border border-surface-border relative overflow-hidden"
        >
          <div
            aria-hidden="true"
            className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary-500/15 blur-3xl"
          />
          <div className="relative">
            <p className="text-sm uppercase tracking-[0.18em] font-semibold text-primary-300 mb-2">
              Install
            </p>
            <h3 className="text-lg font-semibold text-stone-50 mb-1">
              Add isVisible to your device
            </h3>
            <p className="text-sm text-stone-300 mb-4">
              Works offline. Opens like a native app. No store needed.
            </p>
            <Button onClick={install} size="lg" className="w-full sm:w-auto">
              Install isVisible
            </Button>
          </div>
        </section>
      )}

      <p role="status" aria-live="polite" className="sr-only">{hint}</p>
    </div>
  );
}
