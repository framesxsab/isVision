/**
 * VoiceNavPage — Push-to-talk voice command interface.
 * Shows available commands, push-to-talk button, command history.
 */

import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { speechRecognition } from "@/core/speech/SpeechRecognition";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { earcons } from "@/core/audio/Earcons";
import { commands, matchCommand } from "./commandRegistry";
import { Button } from "@/components/Button";
import { IconArrowLeft, IconMicrophone, IconEar } from "@/components/Icons";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { useSettingsStore } from "@/core/store/settingsStore";

interface HistoryEntry {
  transcript: string;
  command: string | null;
  timestamp: number;
}

export default function VoiceNavPage() {
  const navigate = useNavigate();
  const announce = useAnnounce();
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const setSpeechRate = useSettingsStore((s) => s.setSpeechRate);
  const speechRate = useSettingsStore((s) => s.speechRate);

  useEffect(() => {
    announce("Voice Navigation is ready. Press and hold the button to speak a command.");
    speechEngine.speak("Voice Navigation is ready. Press the large button and speak a command. Say help for a list of commands.");
  }, [announce]);

  const executeAction = useCallback(
    (action: string) => {
      switch (action) {
        case "help": {
          const helpText = commands
            .filter((c) => c.module === "global")
            .map((c) => `${c.patterns[0]}: ${c.description}`)
            .join(". ");
          speechEngine.interrupt(`Available commands. ${helpText}`);
          break;
        }
        case "navigate_home":
          navigate("/");
          speechEngine.interrupt("Going home.");
          break;
        case "navigate_back":
          navigate(-1);
          speechEngine.interrupt("Going back.");
          break;
        case "navigate_settings":
          navigate("/settings");
          speechEngine.interrupt("Opening settings.");
          break;
        case "navigate_touch_explorer":
          navigate("/touch-explorer");
          speechEngine.interrupt("Opening Touch Explorer.");
          break;
        case "navigate_ai_vision":
          navigate("/ai-vision");
          speechEngine.interrupt("Opening AI Vision.");
          break;
        case "navigate_reader":
          navigate("/reader");
          speechEngine.interrupt("Opening Accessible Reader.");
          break;
        case "navigate_tactile_output":
          navigate("/tactile-output");
          speechEngine.interrupt("Opening Tactile Output Lab.");
          break;
        case "navigate_tactile_drill":
          navigate("/tactile-drill");
          speechEngine.interrupt("Opening Tactile Drill.");
          break;
        case "stop_speech":
          speechEngine.stop();
          break;
        case "speed_up":
          setSpeechRate(Math.min(3, speechRate + 0.2));
          speechEngine.setRate(speechRate + 0.2);
          speechEngine.interrupt(`Speed ${(speechRate + 0.2).toFixed(1)}x`);
          break;
        case "slow_down":
          setSpeechRate(Math.max(0.5, speechRate - 0.2));
          speechEngine.setRate(speechRate - 0.2);
          speechEngine.interrupt(`Speed ${(speechRate - 0.2).toFixed(1)}x`);
          break;
        default:
          speechEngine.interrupt(`Command ${action} is available on its module page.`);
      }
    },
    [navigate, setSpeechRate, speechRate]
  );

  const handleListen = useCallback(async () => {
    if (!speechRecognition.isSupported) {
      speechEngine.interrupt("Voice recognition is not supported in this browser. Try Chrome on Android.");
      return;
    }

    setIsListening(true);
    speechEngine.stop();
    earcons.activate();
    announce("Listening");

    try {
      const transcript = await speechRecognition.listen();
      setIsListening(false);
      setLastTranscript(transcript);

      const match = matchCommand(transcript);

      const entry: HistoryEntry = {
        transcript,
        command: match?.command.name ?? null,
        timestamp: Date.now(),
      };
      setHistory((prev) => [entry, ...prev].slice(0, 20));

      if (match && match.confidence >= 0.6) {
        earcons.success();
        announce(`${match.command.description}`);
        speechEngine.interrupt(`${match.command.description}`);
        // Small delay so user hears confirmation before navigation
        setTimeout(() => executeAction(match.command.action), 500);
      } else {
        earcons.error();
        speechEngine.interrupt(`I didn't understand "${transcript}". Say help for available commands.`);
      }
    } catch (err) {
      setIsListening(false);
      const msg = err instanceof Error ? err.message : "Could not recognize speech.";
      speechEngine.interrupt(msg);
    }
  }, [announce, executeAction]);

  // Group commands by module
  const groupedCommands = commands.reduce<Record<string, typeof commands>>(
    (acc, cmd) => {
      (acc[cmd.module] ??= []).push(cmd);
      return acc;
    },
    {}
  );

  const moduleLabels: Record<string, string> = {
    global: "General",
    "touch-explorer": "Touch Explorer",
    "ai-vision": "AI Vision",
    reader: "Reader",
    "tactile-output": "Tactile Output",
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Toolbar */}
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button variant="ghost" onClick={() => navigate("/")} aria-label="Go back to home">
            <IconArrowLeft className="w-5 h-5 inline mr-1" /> Back
          </Button>
          <h1 className="text-lg font-bold text-white">Voice Nav</h1>
          <div className="w-20" />
        </div>
      </header>

      {/* Push-to-talk area */}
      <div className="flex flex-col items-center justify-center py-8 px-4">
        <button
          onClick={handleListen}
          disabled={isListening}
          className={`
            w-32 h-32 rounded-full flex items-center justify-center
            text-5xl transition-all duration-200
            focus-visible:ring-4 focus-visible:ring-primary-400 focus-visible:ring-offset-4 focus-visible:ring-offset-gray-950
            ${
              isListening
                ? "bg-red-600 border-4 border-red-400 animate-pulse"
                : "bg-primary-600 border-4 border-primary-400 hover:bg-primary-500 active:bg-primary-700"
            }
          `}
          aria-label={isListening ? "Listening for your command" : "Press to speak a command"}
        >
          {isListening ? (
            <IconEar className="w-12 h-12 text-white" />
          ) : (
            <IconMicrophone className="w-12 h-12 text-white" />
          )}
        </button>
        <p className="text-gray-400 mt-4 text-center" aria-live="polite">
          {isListening
            ? "Listening... speak now"
            : lastTranscript
              ? `You said: "${lastTranscript}"`
              : "Tap the button and speak a command"}
        </p>
      </div>

      {/* Command reference */}
      <div className="flex-1 px-4 pb-24">
        <div className="max-w-lg mx-auto space-y-6">
          <h2 className="text-xl font-bold text-white">Available Commands</h2>

          {Object.entries(groupedCommands).map(([module, cmds]) => (
            <section key={module} aria-label={`${moduleLabels[module] ?? module} commands`}>
              <h3 className="text-sm font-semibold text-primary-400 uppercase tracking-wider mb-2">
                {moduleLabels[module] ?? module}
              </h3>
              <ul className="space-y-1">
                {cmds.map((cmd) => (
                  <li
                    key={cmd.name}
                    className="flex justify-between items-center bg-gray-900 rounded-lg px-4 py-3 min-h-touch"
                  >
                    <span className="text-white font-medium">
                      "{cmd.patterns[0]}"
                    </span>
                    <span className="text-gray-400 text-sm">{cmd.description}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-gray-950 border-t border-gray-800 px-4 py-3">
          <details className="max-w-lg mx-auto">
            <summary className="text-sm text-gray-400 cursor-pointer min-h-touch flex items-center">
              Command history ({history.length})
            </summary>
            <ul className="mt-2 space-y-1">
              {history.map((entry, i) => (
                <li
                  key={i}
                  className="flex justify-between items-center bg-gray-900 rounded px-3 py-2 text-sm"
                >
                  <span className="text-gray-300">"{entry.transcript}"</span>
                  <span
                    className={
                      entry.command ? "text-green-400" : "text-red-400"
                    }
                  >
                    {entry.command ?? "not recognized"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
