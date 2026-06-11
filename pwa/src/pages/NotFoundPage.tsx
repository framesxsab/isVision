import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import {
  IconArrowLeft,
  IconEar,
  IconHome,
  IconMicrophone,
  IconSettings,
} from "@/components/Icons";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useAnnounce } from "@/core/a11y/AriaLive";

export default function NotFoundPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const announce = useAnnounce();
  const headingRef = useRef<HTMLHeadingElement | null>(null);

  useEffect(() => {
    const message =
      "Page not found. Choose Home, Settings, Voice Navigation, or Troubleshoot.";
    headingRef.current?.focus();
    announce(message);
    speechEngine.speak(message, { remember: false });
  }, [announce]);

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8 max-w-2xl mx-auto flex items-center">
      <div className="w-full surface-panel border border-surface-border rounded-2xl p-5 sm:p-7">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary-300 mb-3">
          Route recovery
        </p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="text-2xl sm:text-3xl font-bold text-white mb-3 focus:outline-none"
        >
          Page not found
        </h1>
        <p className="text-stone-300 leading-relaxed mb-2">
          This address does not match an isVisible screen.
        </p>
        <p className="text-sm text-stone-400 leading-relaxed mb-6 break-words">
          Current route: <span className="font-mono text-stone-200">{location.pathname}</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" aria-label="Recovery actions">
          <Button onClick={() => navigate("/")} className="justify-start">
            <IconHome className="w-5 h-5 inline mr-2" /> Home
          </Button>
          <Button onClick={() => navigate("/voice-nav")} variant="secondary" className="justify-start">
            <IconMicrophone className="w-5 h-5 inline mr-2" /> Voice Navigation
          </Button>
          <Button onClick={() => navigate("/settings")} variant="secondary" className="justify-start">
            <IconSettings className="w-5 h-5 inline mr-2" /> Settings
          </Button>
          <Button onClick={() => navigate("/troubleshoot")} variant="secondary" className="justify-start">
            <IconEar className="w-5 h-5 inline mr-2" /> Troubleshoot
          </Button>
        </div>

        <div className="mt-5 pt-4 border-t border-surface-border">
          <Button onClick={() => navigate(-1)} variant="ghost" className="w-full sm:w-auto">
            <IconArrowLeft className="w-5 h-5 inline mr-2" /> Go back
          </Button>
          <p className="text-xs text-stone-500 mt-3 leading-relaxed">
            You can also press F6 and say “open reader”, “open camera”, or “help”.
          </p>
        </div>
      </div>
    </div>
  );
}
