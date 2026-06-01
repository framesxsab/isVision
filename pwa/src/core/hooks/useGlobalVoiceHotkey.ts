import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { speechRecognition } from "@/core/speech/SpeechRecognition";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { matchCommandWithAlternatives } from "@/modules/voice-nav/commandRegistry";
import { answerQuestion } from "@/modules/voice-nav/assistantAnswers";
import { useSettingsStore } from "@/core/store/settingsStore";

/**
 * Global hotkey (F6) to activate voice commands from ANY page.
 * If the user is already on the Voice Nav page, this is a no-op
 * (the page handles its own push-to-talk).
 */
export function useGlobalVoiceHotkey() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "F6") return;
      if (location.pathname === "/voice-nav") return;
      if (!speechRecognition.isSupported) return;

      e.preventDefault();
      speechEngine.interrupt("Listening.");

      try {
        const result = await speechRecognition.listenWithAlternatives();
        const match = matchCommandWithAlternatives(result.alternatives);
        // Read the setting at the moment the command lands, not at mount —
        // keeps the hotkey honoring a toggle the user just flipped without
        // re-subscribing the effect on every render.
        const confirmAloud = useSettingsStore.getState().voiceConfirmAloud;

        if (match && match.confidence >= 0.65) {
          const navDelayMs = confirmAloud ? 400 : 0;
          if (confirmAloud) {
            speechEngine.interrupt(match.command.description);
          }

          // Handle navigation commands directly
          const navMap: Record<string, string> = {
            navigate_home: "/",
            navigate_settings: "/settings",
            navigate_touch_explorer: "/touch-explorer",
            navigate_ai_vision: "/ai-vision",
            navigate_reader: "/reader",
            navigate_tactile_output: "/tactile-output",
          };

          const path = navMap[match.command.action];
          if (path) {
            if (navDelayMs > 0) setTimeout(() => navigate(path), navDelayMs);
            else navigate(path);
          } else if (match.command.action === "stop_speech") {
            speechEngine.stop();
          } else if (match.command.action === "navigate_back") {
            navigate(-1);
            } else if (match.command.action === "help") {
              speechEngine.interrupt(
                "Press F6 to speak a command. Say: go home, settings, touch explorer, camera, reader, tactile lab, or voice nav."
              );
            }
        } else {
          // Command didn't match — try answering as a question. This is
          // what makes F6 feel like a real assistant rather than a strict
          // command line: a blind user can ask "what is this" or "how do
          // I use the reader" without learning the verbs.
          const answer = answerQuestion(result.transcript, location.pathname);
          if (answer) {
            speechEngine.interrupt(answer.spoken);
          } else {
            speechEngine.interrupt(
              `I didn't understand "${result.transcript}". Try asking "what is this", or say "open reader". Press F6 to try again.`
            );
          }
        }
      } catch {
        // User cancelled or no speech detected — silent
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, location.pathname]);
}
