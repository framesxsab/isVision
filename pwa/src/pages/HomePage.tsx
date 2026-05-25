import { useNavigate } from "react-router-dom";
import { Card } from "@/components/Card";
import { useSettingsStore } from "@/core/store/settingsStore";
import { useEffect } from "react";

const modules = [
  {
    id: "touch-explorer",
    title: "Touch Explorer",
    description: "Touch the screen to hear what's there. Feel buttons, links, and headings.",
    icon: "👆",
    path: "/touch-explorer",
    ready: true,
  },
  {
    id: "ai-vision",
    title: "AI Vision",
    description: "Point your camera at anything. AI describes what it sees.",
    icon: "📷",
    path: "/ai-vision",
    ready: true,
  },
  {
    id: "reader",
    title: "Accessible Reader",
    description: "Paste any URL. Hear the article read aloud, clean and clear.",
    icon: "📖",
    path: "/reader",
    ready: true,
  },
  {
    id: "voice-nav",
    title: "Voice Navigation",
    description: "Speak commands to control everything. Hands-free operation.",
    icon: "🎤",
    path: "/voice-nav",
    ready: true,
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
              description={
                mod.ready
                  ? mod.description
                  : `${mod.description} (Coming soon)`
              }
              icon={<span>{mod.icon}</span>}
              onClick={() => {
                if (mod.ready) navigate(mod.path);
              }}
              className={mod.ready ? "" : "opacity-60"}
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
