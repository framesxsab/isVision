import { useNavigate } from "react-router-dom";
import { Card } from "@/components/Card";
import { IconTouch, IconCamera, IconBook, IconMicrophone } from "@/components/Icons";
import { useSettingsStore } from "@/core/store/settingsStore";
import { useEffect } from "react";
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
    description: "Touch the screen to hear what's there. Feel buttons, links, and headings.",
    icon: <IconTouch className="w-6 h-6 text-primary-300" />,
    path: "/touch-explorer",
  },
  {
    id: "ai-vision",
    title: "AI Vision",
    description: "Point your camera at anything. AI describes what it sees.",
    icon: <IconCamera className="w-6 h-6 text-primary-300" />,
    path: "/ai-vision",
  },
  {
    id: "reader",
    title: "Accessible Reader",
    description: "Paste any URL. Hear the article read aloud, clean and clear.",
    icon: <IconBook className="w-6 h-6 text-primary-300" />,
    path: "/reader",
  },
  {
    id: "voice-nav",
    title: "Voice Navigation",
    description: "Speak commands to control everything. Hands-free operation.",
    icon: <IconMicrophone className="w-6 h-6 text-primary-300" />,
    path: "/voice-nav",
  },
];

export default function HomePage() {
  const navigate = useNavigate();
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);

  useEffect(() => {
    if (!onboardingComplete) {
      navigate("/onboarding");
    }
  }, [onboardingComplete, navigate]);

  return (
    <div className="min-h-screen px-4 py-6 max-w-lg mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-white">isVisible</h1>
        <p className="text-gray-400 mt-2 text-lg">
          Touch, hear, and navigate the visual world.
        </p>
      </header>

      <section aria-label="Modules">
        <h2 className="sr-only">Available modules</h2>
        <div className="space-y-4">
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

      <footer className="mt-12 text-center text-sm text-gray-500">
        <p>Built for the community. Open source.</p>
      </footer>
    </div>
  );
}
