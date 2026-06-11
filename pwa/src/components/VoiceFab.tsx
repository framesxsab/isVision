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
import { useLocation, useNavigate } from "react-router-dom";
import { STOPPED_ERROR_MESSAGE, speechRecognition } from "@/core/speech/SpeechRecognition";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { earcons } from "@/core/audio/Earcons";
import { resolveVoiceCommand } from "@/modules/voice-nav/commandRegistry";
import { answerQuestion } from "@/modules/voice-nav/assistantAnswers";
import { runVoiceAction } from "@/modules/voice-nav/voiceActions";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { useSettingsStore } from "@/core/store/settingsStore";
import { IconEar, IconMicrophone } from "./Icons";

const HIDDEN_ROUTES = new Set(["/voice-nav", "/onboarding"]);

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
        "Voice recognition isn't available in this browser. Opening Voice Navigation for instructions.",
        { remember: false }
      );
      navigate("/voice-nav");
      return;
    }

    setIsListening(true);
    speechEngine.stop();
    earcons.activate();
    announce("Listening for up to thirty seconds");

    try {
      const result = await speechRecognition.listenWithAlternatives();
      setIsListening(false);

      const confirmAloud = useSettingsStore.getState().voiceConfirmAloud;
      const match = await resolveVoiceCommand(result.alternatives);

      if (match && match.confidence >= 0.55) {
        earcons.success();
        if (confirmAloud) {
          speechEngine.interrupt(match.command.description, { remember: false });
        }
        runVoiceAction({
          action: match.command.action,
          navigate,
          pathname: location.pathname,
          silent: confirmAloud,
        });
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
      if (message === STOPPED_ERROR_MESSAGE) return;
      // Mic-denied messages are spoken so a blind user knows what to fix.
      speechEngine.interrupt(message, { remember: false });
    }
  }, [announce, navigate, location.pathname, supported]);

  const handleStop = useCallback(() => {
    speechRecognition.stop();
    setIsListening(false);
    announce("Stopped listening.");
  }, [announce]);

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
        onClick={isListening ? handleStop : handleClick}
        aria-label={
          isListening
            ? "Stop listening."
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
