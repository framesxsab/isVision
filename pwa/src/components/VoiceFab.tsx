/**
 * VoiceFab — Always-visible floating microphone button.
 *
 * The single most accessible thing we can do for a blind first-time visitor
 * is make voice obviously available without them having to discover the F6
 * key. This button:
 *
 *  - Sits above the bottom tab bar on every page
 *  - Listens on a single tap
 *  - First tries to match a command (navigation, reader controls, etc.)
 *  - Then falls back to the conversational assistant ("what is this",
 *    "how do I use the reader", "take a tour")
 *  - Hides itself on /voice-nav (that page has its own big mic) and on
 *    /onboarding (don't compete with the guided flow)
 */

import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, type NavigateFunction } from "react-router-dom";
import { speechRecognition } from "@/core/speech/SpeechRecognition";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { earcons } from "@/core/audio/Earcons";
import {
  matchCommandWithAlternatives,
} from "@/modules/voice-nav/commandRegistry";
import { answerQuestion } from "@/modules/voice-nav/assistantAnswers";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { useSettingsStore } from "@/core/store/settingsStore";
import { IconEar, IconMicrophone } from "./Icons";

const HIDDEN_ROUTES = new Set(["/voice-nav", "/onboarding"]);

const NAV_ACTIONS: Record<string, string> = {
  navigate_home: "/",
  navigate_settings: "/settings",
  navigate_touch_explorer: "/touch-explorer",
  navigate_ai_vision: "/ai-vision",
  navigate_reader: "/reader",
  navigate_tactile_output: "/tactile-output",
  navigate_tactile_drill: "/tactile-drill",
};

export function VoiceFab() {
  const navigate = useNavigate();
  const location = useLocation();
  const announce = useAnnounce();
  const [isListening, setIsListening] = useState(false);

  // Keep a stable hook order — early-return *render*, not the effect.
  const supported = speechRecognition.isSupported;
  const hidden = HIDDEN_ROUTES.has(location.pathname);

  const handleClick = useCallback(async () => {
    if (!supported) {
      // Browsers without Web Speech API: send the user to the page that
      // explains the limitation rather than failing silently.
      speechEngine.interrupt(
        "Voice recognition isn't available in this browser. Opening Voice Navigation for instructions."
      );
      navigate("/voice-nav");
      return;
    }

    setIsListening(true);
    speechEngine.stop();
    earcons.activate();
    announce("Listening");

    try {
      const result = await speechRecognition.listenWithAlternatives();
      setIsListening(false);

      const confirmAloud = useSettingsStore.getState().voiceConfirmAloud;
      const match = matchCommandWithAlternatives(result.alternatives);

      if (match && match.confidence >= 0.65) {
        earcons.success();
        if (confirmAloud) {
          speechEngine.interrupt(match.command.description);
        }
        runCommandAction(match.command.action, navigate);
        return;
      }

      // No command match — try the conversational layer.
      const answer = answerQuestion(result.transcript, location.pathname);
      if (answer) {
        earcons.success();
        announce(answer.spoken);
        speechEngine.interrupt(answer.spoken);
        return;
      }

      earcons.error();
      speechEngine.interrupt(
        `I didn't understand "${result.transcript}". Try asking "what is this", "take a tour", or say "open reader".`
      );
    } catch (err) {
      setIsListening(false);
      const message =
        err instanceof Error ? err.message : "Could not recognize speech.";
      // Mic-denied messages are spoken so a blind user knows what to fix.
      speechEngine.interrupt(message);
    }
  }, [announce, navigate, location.pathname, supported]);

  // Spacebar shortcut while focused — common AT convention for "activate".
  // We don't bind a global hotkey here; F6 already covers that.
  useEffect(() => {
    if (!isListening) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        speechRecognition.stop();
        setIsListening(false);
      }
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [isListening]);

  if (hidden) return null;

  return (
    <div
      className="fixed right-4 sm:right-6 lg:right-8 z-50 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 6.25rem)" }}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={isListening}
        aria-label={
          isListening
            ? "Listening for your question or command. Press Escape to cancel."
            : "Ask isVisible. Tap to speak a command or question."
        }
        className={`
          pointer-events-auto group relative
          flex items-center justify-center
          w-16 h-16 lg:w-[72px] lg:h-[72px]
          rounded-full
          text-white
          shadow-[0_18px_50px_-12px_rgba(251,146,60,0.55)]
          transition-all duration-200
          focus-visible:ring-4 focus-visible:ring-primary-300 focus-visible:ring-offset-4 focus-visible:ring-offset-surface-0
          ${
            isListening
              ? "bg-rose-500 ring-4 ring-rose-300/60 animate-pulse"
              : "bg-gradient-to-br from-primary-400 to-yellow-500 hover:scale-105 active:scale-95"
          }
        `}
      >
        {/* Soft halo so a blind user's sighted helper can spot the affordance
            from across a room. Decorative, hidden from AT. */}
        <span
          aria-hidden="true"
          className={`absolute inset-0 -z-10 rounded-full blur-2xl transition-opacity duration-300 ${
            isListening
              ? "bg-rose-400/70 opacity-100"
              : "bg-primary-400/60 opacity-60 group-hover:opacity-90"
          }`}
        />
        {isListening ? (
          <IconEar className="w-7 h-7 lg:w-8 lg:h-8" />
        ) : (
          <IconMicrophone className="w-7 h-7 lg:w-8 lg:h-8" />
        )}
      </button>
    </div>
  );
}

function runCommandAction(action: string, navigate: NavigateFunction) {
  const path = NAV_ACTIONS[action];
  if (path) {
    navigate(path);
    return;
  }
  if (action === "navigate_back") {
    navigate(-1);
    return;
  }
  if (action === "stop_speech") {
    speechEngine.stop();
    return;
  }
  if (action === "help") {
    speechEngine.interrupt(
      "You can ask me to open any module — say open reader, open camera, open touch explorer, open voice nav, " +
        "open tactile lab, or open drill. Ask what is this for a description, or take a tour for an overview."
    );
    return;
  }
  // Module-specific actions (reader play/pause, capture, etc.) only work
  // on their own pages. Be honest about that rather than failing silently.
  speechEngine.interrupt(
    "That command works on its module page. Try opening the module first."
  );
}
