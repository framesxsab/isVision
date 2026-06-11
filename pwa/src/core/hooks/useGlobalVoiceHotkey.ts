import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { speechRecognition } from "@/core/speech/SpeechRecognition";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { resolveVoiceCommand } from "@/modules/voice-nav/commandRegistry";
import { answerQuestion } from "@/modules/voice-nav/assistantAnswers";
import { runVoiceAction } from "@/modules/voice-nav/voiceActions";
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
      speechEngine.interrupt("Listening for up to thirty seconds.", { remember: false });

      try {
        const result = await speechRecognition.listenWithAlternatives();
        const match = await resolveVoiceCommand(result.alternatives);
        // Read the setting at the moment the command lands, not at mount —
        // keeps the hotkey honoring a toggle the user just flipped without
        // re-subscribing the effect on every render.
        const confirmAloud = useSettingsStore.getState().voiceConfirmAloud;

        if (match && match.confidence >= 0.55) {
          if (confirmAloud) {
            speechEngine.interrupt(match.command.description, { remember: false });
          }
          const run = () =>
            runVoiceAction({
              action: match.command.action,
              navigate,
              pathname: location.pathname,
              silent: confirmAloud,
            });
          if (confirmAloud) setTimeout(run, 400);
          else run();
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
