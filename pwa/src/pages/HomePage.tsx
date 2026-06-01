import { useNavigate } from "react-router-dom";
import { useSettingsStore } from "@/core/store/settingsStore";
import { useInstallPrompt } from "@/core/hooks/useInstallPrompt";
import { Button } from "@/components/Button";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  IconBook,
  IconBraille,
  IconCamera,
  IconMicrophone,
  IconSettings,
  IconTarget,
  IconTouch,
} from "@/components/Icons";
import { type CardAccent } from "@/components/Card";

interface ModuleInfo {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  path: string;
  accent: CardAccent;
  meta: string;
  featured?: boolean;
}

const modules: ModuleInfo[] = [
  {
    id: "touch-explorer",
    title: "Touch Explorer",
    description:
      "Drag your finger across any screen. Hear every button, link, and heading as you touch it.",
    icon: <IconTouch className="w-6 h-6" />,
    path: "/touch-explorer",
    accent: "orange",
    meta: "Touch + haptics",
    featured: true,
  },
  {
    id: "ai-vision",
    title: "AI Vision",
    description:
      "Point the camera. Hear a full spoken description of whatever is in front of you.",
    icon: <IconCamera className="w-6 h-6" />,
    path: "/ai-vision",
    accent: "yellow",
    meta: "Camera + AI",
    featured: true,
  },
  {
    id: "reader",
    title: "Accessible Reader",
    description: "Paste any URL. Clean, distraction-free article read aloud.",
    icon: <IconBook className="w-5 h-5" />,
    path: "/reader",
    accent: "amber",
    meta: "Read aloud",
  },
  {
    id: "voice-nav",
    title: "Voice Navigation",
    description: "Run the whole app hands-free. Just speak.",
    icon: <IconMicrophone className="w-5 h-5" />,
    path: "/voice-nav",
    accent: "emerald",
    meta: "Hands-free",
  },
  {
    id: "tactile-output",
    title: "Tactile Output",
    description: "Convert text to braille for refreshable displays.",
    icon: <IconBraille className="w-5 h-5" />,
    path: "/tactile-output",
    accent: "rose",
    meta: "Braille",
  },
  {
    id: "tactile-drill",
    title: "Tactile Drill",
    description: "Practice braille. Track your accuracy.",
    icon: <IconTarget className="w-5 h-5" />,
    path: "/tactile-drill",
    accent: "yellow",
    meta: "Practice",
  },
];

const accentGradients: Record<CardAccent, string> = {
  orange: "from-orange-500/20 to-orange-400/5 border-orange-400/25",
  yellow: "from-yellow-500/20 to-yellow-400/5 border-yellow-400/25",
  amber: "from-amber-500/20 to-amber-400/5 border-amber-400/25",
  emerald: "from-emerald-500/20 to-emerald-400/5 border-emerald-400/25",
  rose: "from-rose-500/20 to-rose-400/5 border-rose-400/25",
};

const accentIconColors: Record<CardAccent, string> = {
  orange: "text-orange-300",
  yellow: "text-yellow-300",
  amber: "text-amber-300",
  emerald: "text-emerald-300",
  rose: "text-rose-300",
};

const accentMetaColors: Record<CardAccent, string> = {
  orange: "text-orange-400",
  yellow: "text-yellow-400",
  amber: "text-amber-400",
  emerald: "text-emerald-400",
  rose: "text-rose-400",
};

function SectionLabel({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-4 mb-8 lg:mb-10" aria-hidden="true">
      <span className="text-[11px] font-mono font-bold tracking-[0.25em] text-primary-400">
        {n}
      </span>
      <span className="flex-1 h-px bg-gradient-to-r from-primary-400/40 to-transparent" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">
        {label}
      </span>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const onboardingComplete = useSettingsStore((s) => s.onboardingComplete);
  const lastSession = useSettingsStore((s) => s.lastSession);
  const setLastSession = useSettingsStore((s) => s.setLastSession);
  const { canInstall, install } = useInstallPrompt();
  const [hint, setHint] = useState("");

  useEffect(() => {
    if (!onboardingComplete) navigate("/onboarding");
  }, [onboardingComplete, navigate]);

  useEffect(() => {
    const id = window.setTimeout(
      () => setHint("Tip: tap the microphone button or press F6 to speak a command or ask a question."),
      1200
    );
    return () => window.clearTimeout(id);
  }, []);

  const featured = modules.filter((m) => m.featured);
  const compact = modules.filter((m) => !m.featured);

  return (
    <div className="min-h-screen pb-nav">
      {/* ── HERO ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden px-5 sm:px-8 lg:px-14 pt-10 sm:pt-14 lg:pt-16 pb-10 lg:pb-14 max-w-7xl mx-auto">
        {/* decorative radial glows — visible at scale, not distracting */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-24 w-[600px] h-[600px] rounded-full bg-orange-500/8 blur-[120px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 right-0 w-[400px] h-[400px] rounded-full bg-yellow-500/8 blur-[100px]"
        />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* pill label */}
            <div className="mb-5 lg:mb-6">
              <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] font-semibold px-3 py-1.5 rounded-full bg-primary-500/10 text-primary-200 border border-primary-400/20">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-primary-300 opacity-75 animate-pulse" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-primary-300" />
                </span>
                Accessibility platform
              </span>
            </div>

            {/* display headline — this is the thing that should stop the eye */}
            <h1 className="font-black leading-[0.9] tracking-tight">
              <span
                className="block text-[3.5rem] sm:text-[5rem] lg:text-[7.5rem] xl:text-[9rem] text-stone-50"
                style={{ letterSpacing: "-0.035em" }}
              >
                is
                <span
                  className="text-gradient-warm"
                  style={{
                    background:
                      "linear-gradient(110deg, #fdba74 0%, #fb923c 40%, #fde047 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                  }}
                >
                  Visible
                </span>
                <span
                  aria-hidden="true"
                  className="inline-block ml-2 align-[0.12em] w-[0.3em] h-[0.3em] rounded-full bg-primary-400"
                  style={{ boxShadow: "0 0 28px 8px rgba(251,146,60,0.55)" }}
                />
              </span>
            </h1>

            {/* tagline — intentional contrast: thin weight after the heavy headline */}
            <p className="mt-4 lg:mt-6 text-xl sm:text-2xl lg:text-3xl font-light text-stone-400 tracking-wide max-w-2xl">
              Touch.{" "}
              <span className="text-stone-300">Hear.</span>{" "}
              <span className="text-stone-200">Navigate.</span>
            </p>
            <p className="mt-2 text-base sm:text-lg text-stone-500 max-w-xl leading-relaxed">
              Built for blind and low-vision people.
            </p>
          </div>

          <button
            onClick={() => navigate("/settings")}
            aria-label="Open settings"
            className="shrink-0 mt-1 inline-flex items-center justify-center w-11 h-11 rounded-full bg-white/5 border border-white/10 text-stone-400 hover:text-stone-100 hover:bg-white/10 transition-colors focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07090c]"
          >
            <IconSettings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* divider */}
      <div
        aria-hidden="true"
        className="mx-5 sm:mx-8 lg:mx-14 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent"
      />

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="px-5 sm:px-8 lg:px-14 py-10 lg:py-14 max-w-7xl mx-auto space-y-16 lg:space-y-20">

        {/* resume card */}
        {lastSession?.route === "/reader" &&
          typeof lastSession.payload.url === "string" &&
          Number(lastSession.payload.total) > 0 && (
            <ResumeCard
              title={String(lastSession.payload.title ?? "Article")}
              url={String(lastSession.payload.url)}
              chunkIndex={Number(lastSession.payload.chunkIndex) || 0}
              total={Number(lastSession.payload.total)}
              onResume={() =>
                navigate("/reader", {
                  state: {
                    resume: {
                      url: String(lastSession.payload.url),
                      chunkIndex: Number(lastSession.payload.chunkIndex) || 0,
                    },
                  },
                })
              }
              onDismiss={() => setLastSession(null)}
            />
          )}

        {/* ── SECTION 01: SPEAK ── */}
        <section aria-labelledby="speak-heading">
          <SectionLabel n="01" label="Speak" />

          {/* Voice CTA — centered, large, feels like a real affordance */}
          <button
            id="speak-heading"
            onClick={() => navigate("/voice-nav")}
            className="
              group relative w-full rounded-3xl overflow-hidden
              border border-primary-400/20
              bg-gradient-to-br from-primary-500/12 via-transparent to-yellow-500/8
              hover:border-primary-400/40 hover:from-primary-500/18
              transition-all duration-300
              focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07090c]
              text-left
            "
            aria-label="Open Voice Navigation. Ask isVisible anything by voice."
          >
            {/* top-right glow */}
            <div
              aria-hidden="true"
              className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary-400/15 blur-3xl pointer-events-none"
            />

            <div className="relative px-7 sm:px-10 lg:px-16 py-10 sm:py-12 lg:py-16 flex flex-col sm:flex-row items-center gap-8 lg:gap-14">
              {/* big mic icon */}
              <div
                aria-hidden="true"
                className="shrink-0 flex items-center justify-center w-20 h-20 lg:w-28 lg:h-28 rounded-full bg-primary-500/20 border-2 border-primary-400/40 group-hover:border-primary-300/60 transition-colors"
                style={{ boxShadow: "0 0 50px rgba(251,146,60,0.15)" }}
              >
                <IconMicrophone className="w-9 h-9 lg:w-12 lg:h-12 text-primary-200" />
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] font-semibold text-primary-400 mb-2">
                  Voice assistant
                </p>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-stone-50 tracking-tight mb-3">
                  Ask isVisible anything
                </h2>
                <p className="text-base sm:text-lg text-stone-400 leading-relaxed max-w-lg">
                  Tap, or press{" "}
                  <kbd className="px-1.5 py-0.5 rounded-md bg-white/8 border border-white/12 text-xs font-mono text-stone-200">
                    F6
                  </kbd>
                  , then speak. Try{" "}
                  <em className="not-italic text-stone-200 font-medium">"what is this"</em>
                  {", "}
                  <em className="not-italic text-stone-200 font-medium">"open reader"</em>
                  {", or "}
                  <em className="not-italic text-stone-200 font-medium">"take a tour"</em>.
                </p>
              </div>

              {/* right arrow — subtle cue to tap */}
              <svg
                aria-hidden="true"
                className="hidden sm:block ml-auto shrink-0 w-7 h-7 text-stone-500 group-hover:text-primary-300 group-hover:translate-x-1 transition-all"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
              </svg>
            </div>
          </button>
        </section>

        {/* ── SECTION 02: EXPLORE ── */}
        <section aria-labelledby="explore-heading">
          <h2 id="explore-heading" className="sr-only">
            Explore modules
          </h2>
          <SectionLabel n="02" label="Explore" />

          {/* Featured cards — larger, more presence */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5 mb-4 lg:mb-5">
            {featured.map((mod) => (
              <FeaturedCard key={mod.id} mod={mod} onClick={() => navigate(mod.path)} />
            ))}
          </div>

          {/* Compact cards — 2-col on sm, 4-col on lg */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {compact.map((mod) => (
              <CompactCard key={mod.id} mod={mod} onClick={() => navigate(mod.path)} />
            ))}
          </div>
        </section>

        {/* Install prompt */}
        {canInstall && (
          <section
            aria-label="Install app"
            className="relative overflow-hidden rounded-2xl border border-white/8 bg-white/3 p-6 sm:p-8"
          >
            <div
              aria-hidden="true"
              className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-primary-500/10 blur-3xl"
            />
            <div className="relative max-w-md">
              <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-primary-400 mb-2">
                Install
              </p>
              <h3 className="text-xl font-bold text-stone-50 mb-1">
                Add isVisible to your device
              </h3>
              <p className="text-sm text-stone-400 mb-5">
                Works offline. Opens like a native app. No store needed.
              </p>
              <Button onClick={install} size="lg">
                Install isVisible
              </Button>
            </div>
          </section>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">{hint}</p>
    </div>
  );
}

function FeaturedCard({ mod, onClick }: { mod: ModuleInfo; onClick: () => void }) {
  const g = accentGradients[mod.accent];
  const iconColor = accentIconColors[mod.accent];
  const metaColor = accentMetaColors[mod.accent];

  return (
    <button
      onClick={onClick}
      className={`
        group relative w-full min-h-[160px] sm:min-h-[180px] lg:min-h-[200px]
        rounded-2xl border bg-gradient-to-br ${g}
        p-5 sm:p-6 lg:p-7
        text-left overflow-hidden
        hover:-translate-y-0.5 transition-all duration-200
        focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07090c]
      `}
      aria-label={`${mod.title}. ${mod.description}`}
    >
      <div
        aria-hidden="true"
        className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/3 blur-2xl"
      />
      <div className="relative flex flex-col h-full">
        <div className={`${iconColor} mb-4`}>{mod.icon}</div>
        <h3 className="text-xl lg:text-2xl font-bold text-stone-50 tracking-tight mb-2">
          {mod.title}
        </h3>
        <p className="text-sm lg:text-base text-stone-300/90 leading-relaxed flex-1">
          {mod.description}
        </p>
        <div className="flex items-center justify-between mt-5">
          <span className={`text-[10px] uppercase tracking-[0.18em] font-bold ${metaColor}`}>
            {mod.meta}
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`w-5 h-5 ${iconColor} opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all`}
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </div>
      </div>
    </button>
  );
}

function CompactCard({ mod, onClick }: { mod: ModuleInfo; onClick: () => void }) {
  const g = accentGradients[mod.accent];
  const iconColor = accentIconColors[mod.accent];
  const metaColor = accentMetaColors[mod.accent];

  return (
    <button
      onClick={onClick}
      className={`
        group relative w-full
        rounded-xl border bg-gradient-to-br ${g}
        p-4 sm:p-5
        text-left overflow-hidden
        hover:-translate-y-0.5 transition-all duration-200
        focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07090c]
        min-h-touch
      `}
      aria-label={`${mod.title}. ${mod.description}`}
    >
      <div className="flex items-start gap-3">
        <span className={`shrink-0 mt-0.5 ${iconColor}`}>{mod.icon}</span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-stone-50 tracking-tight truncate">
            {mod.title}
          </h3>
          <p className="text-xs text-stone-400 mt-0.5 leading-relaxed line-clamp-2">
            {mod.description}
          </p>
          <span className={`mt-2 block text-[10px] uppercase tracking-[0.16em] font-bold ${metaColor}`}>
            {mod.meta}
          </span>
        </div>
      </div>
    </button>
  );
}

function ResumeCard({
  title,
  url,
  chunkIndex,
  total,
  onResume,
  onDismiss,
}: {
  title: string;
  url: string;
  chunkIndex: number;
  total: number;
  onResume: () => void;
  onDismiss: () => void;
}) {
  const position = `Paragraph ${chunkIndex + 1} of ${total}`;
  let domain = url;
  try {
    domain = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // keep original string
  }

  return (
    <section
      aria-label={`Resume reading ${title}, ${position}`}
      className="p-5 rounded-2xl border border-amber-400/25 bg-gradient-to-br from-amber-500/12 to-amber-400/3"
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.22em] font-semibold text-amber-400 mb-1">
            Pick up where you left off
          </p>
          <h3 className="text-lg font-semibold text-stone-50 truncate">{title}</h3>
          <p className="text-xs text-stone-400 mt-0.5 truncate">
            {domain} · {position}
          </p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss resume card"
          className="shrink-0 inline-flex items-center justify-center min-h-touch min-w-touch rounded-full text-stone-400 hover:text-stone-100 hover:bg-white/8 focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07090c] transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <Button onClick={onResume} className="w-full sm:w-auto">Resume reading</Button>
    </section>
  );
}
