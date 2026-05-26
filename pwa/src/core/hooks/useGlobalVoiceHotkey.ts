import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { speechRecognition } from "@/core/speech/SpeechRecognition";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { matchCommand } from "@/modules/voice-nav/commandRegistry";

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
        const transcript = await speechRecognition.listen();
        const match = matchCommand(transcript);

        if (match && match.confidence >= 0.6) {
          speechEngine.interrupt(match.command.description);

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
            setTimeout(() => navigate(path), 400);
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
          speechEngine.interrupt(
            `I didn't understand "${transcript}". Press F6 and try again.`
          );
        }
      } catch {
        // User cancelled or no speech detected — silent
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigate, location.pathname]);
}
