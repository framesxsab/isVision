import { useState, useCallback, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { STOPPED_ERROR_MESSAGE, speechRecognition } from "@/core/speech/SpeechRecognition";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { earcons } from "@/core/audio/Earcons";
import { commands, resolveVoiceCommand } from "./commandRegistry";
import { answerQuestion } from "./assistantAnswers";
import { runVoiceAction } from "./voiceActions";
import { Button } from "@/components/Button";
import { IconEar, IconMicrophone } from "@/components/Icons";
import { PageShell, SectionLabel } from "@/components/PageShell";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { useSettingsStore } from "@/core/store/settingsStore";

interface HistoryEntry {
  transcript: string;
  command: string | null;
  timestamp: number;
}

function isMicPermissionError(message: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return lower.includes("microphone") && (lower.includes("denied") || lower.includes("permission"));
}

export default function VoiceNavPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const announce = useAnnounce();
  const [isListening, setIsListening] = useState(false);
  const [lastTranscript, setLastTranscript] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const setSetupStatus = useSettingsStore((s) => s.setSetupStatus);
  const voiceConfirmAloud = useSettingsStore((s) => s.voiceConfirmAloud);

  useEffect(() => {
    announce("Voice Navigation is ready. Press the button and speak a command.");
    speechEngine.speak(
      "Voice Navigation is ready. Press the large button and speak a command. I will listen for up to thirty seconds. Say help for a list of commands, or ask what is this for a description of the platform."
    );
  }, [announce]);

  const executeAction = useCallback(
    (action: string, options?: { silent?: boolean }) => {
      const silent = options?.silent === true;
      const say = (msg: string) => {
        if (!silent) speechEngine.interrupt(msg, { remember: false });
      };
      switch (action) {
        case "help": {
          const helpText = commands
            .filter((c) => c.module === "global")
            .map((c) => `${c.patterns[0]}: ${c.description}`)
            .join(". ");
          speechEngine.interrupt(`Available commands. ${helpText}`, { remember: false });
          break;
        }
        case "speed_up":
        case "slow_down":
          if (!runVoiceAction({ action, navigate, pathname: location.pathname, silent })) {
            say(`Command ${action} is available on its module page.`);
          }
          break;
        default:
          if (!runVoiceAction({ action, navigate, pathname: location.pathname, silent })) {
            say(`Command ${action} is available on its module page.`);
          }
      }
    },
    [location.pathname, navigate]
  );

  const handleListen = useCallback(async () => {
    if (!speechRecognition.isSupported) {
      const msg = "Voice recognition is not supported in this browser. Try Chrome on Android.";
      setErrorMessage(msg);
      speechEngine.interrupt(msg);
      return;
    }

    setIsListening(true);
    setErrorMessage(null);
    speechEngine.stop();
    earcons.activate();
    announce("Listening for up to thirty seconds");

    try {
      const result = await speechRecognition.listenWithAlternatives();
      setIsListening(false);
      const match = await resolveVoiceCommand(result.alternatives);
      const displayTranscript = match?.matchedAlternative ?? result.transcript;
      setLastTranscript(displayTranscript);

      const entry: HistoryEntry = {
        transcript: displayTranscript,
        command: match?.command.name ?? null,
        timestamp: Date.now(),
      };
      setHistory((prev) => [entry, ...prev].slice(0, 20));

      if (match && match.confidence >= 0.55) {
        earcons.success();
        if (voiceConfirmAloud) {
          const echo = `I heard "${result.transcript}". ${match.command.description}.`;
          announce(echo);
          speechEngine.interrupt(echo, { remember: false });
          setTimeout(() => executeAction(match.command.action, { silent: true }), 1400);
        } else {
          announce(`Running ${match.command.description}.`);
          executeAction(match.command.action);
        }
      } else {
        const answer = answerQuestion(result.transcript, location.pathname);
        if (answer) {
          earcons.success();
          announce(answer.spoken);
          speechEngine.interrupt(answer.spoken);
        } else {
          earcons.error();
          speechEngine.interrupt(
            `I didn't understand "${result.transcript}". Try "what is this", "take a tour", or say help.`
          );
        }
      }
    } catch (err) {
      setIsListening(false);
      const msg = err instanceof Error ? err.message : "Could not recognize speech.";
      if (msg === STOPPED_ERROR_MESSAGE) return;
      setErrorMessage(msg);
      if (isMicPermissionError(msg)) setSetupStatus({ microphone: "denied" });
      speechEngine.interrupt(msg);
    }
  }, [announce, executeAction, location.pathname, setSetupStatus, voiceConfirmAloud]);

  const handleStopListening = useCallback(() => {
    speechRecognition.stop();
    setIsListening(false);
    announce("Stopped listening.");
  }, [announce]);

  const openSetup = useCallback(() => navigate("/onboarding?restart=1"), [navigate]);
  const dismissError = useCallback(() => setErrorMessage(null), []);

  const groupedCommands = commands.reduce<Record<string, typeof commands>>(
    (acc, cmd) => { (acc[cmd.module] ??= []).push(cmd); return acc; },
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
    <PageShell title="Voice Navigation" accent="orange" width="wide">
      {/* Error banner */}
      {errorMessage && (
        <div
          role="alert"
          className="mx-4 sm:mx-6 lg:mx-10 mt-5 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-5 py-4"
        >
          <p className="text-rose-200 text-sm leading-relaxed mb-3">{errorMessage}</p>
          <div className="flex flex-wrap gap-2">
            {isMicPermissionError(errorMessage) ? (
              <>
                <Button onClick={handleListen} variant="secondary">Try again</Button>
                <Button onClick={openSetup} variant="secondary">Run setup again</Button>
              </>
            ) : (
              <Button onClick={dismissError} variant="secondary">Dismiss</Button>
            )}
          </div>
        </div>
      )}

      {/* ── Desktop 2-col layout ── */}
      <div className="flex-1 px-4 sm:px-6 lg:px-10 py-8 max-w-5xl mx-auto w-full">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">

          {/* LEFT — mic + status */}
          <div className="flex flex-col items-center lg:items-start lg:w-64 shrink-0">
            {/* Big mic button */}
            <button
              aria-busy={isListening}
              onClick={isListening ? handleStopListening : handleListen}
              className={`
                relative w-36 h-36 lg:w-40 lg:h-40
                rounded-full flex items-center justify-center
                transition-all duration-200
                focus-visible:ring-4 focus-visible:ring-primary-400 focus-visible:ring-offset-4 focus-visible:ring-offset-surface-0
                ${
                  isListening
                    ? "bg-rose-500/20 border-2 border-rose-400/60 ring-4 ring-rose-400/20 animate-pulse"
                    : "bg-primary-500/15 border-2 border-primary-400/50 hover:bg-primary-500/25 hover:border-primary-300/70"
                }
              `}
              style={!isListening ? { boxShadow: "0 0 60px rgba(251,146,60,0.15)" } : undefined}
              aria-label={isListening ? "Stop listening." : "Press to speak a command or question. You can also press F6 anywhere in the app."}
            >
              {isListening ? (
                <IconEar className="w-14 h-14 text-rose-300" />
              ) : (
                <IconMicrophone className="w-14 h-14 text-primary-300" />
              )}
            </button>

            <p
              className="text-sm text-stone-400 mt-5 text-center lg:text-left"
              aria-live="polite"
            >
              {isListening
                ? "Listening... up to 30 seconds"
                : lastTranscript
                  ? `You said: "${lastTranscript}"`
                  : "Tap the button and speak"}
            </p>

            {/* Quick examples */}
            <div className="mt-6 space-y-2 w-full">
              <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-3">
                Try saying
              </p>
              {[
                "open reader",
                "what is this",
                "take a tour",
                "help",
                "go home",
              ].map((ex) => (
                <div
                  key={ex}
                  className="px-3 py-2 rounded-lg bg-surface-2 border border-surface-border text-sm text-stone-300 font-medium"
                >
                  "{ex}"
                </div>
              ))}
            </div>

            {/* History */}
            {history.length > 0 && (
              <details className="mt-6 w-full">
                <summary className="text-sm text-stone-400 cursor-pointer min-h-touch flex items-center gap-2 select-none">
                  <span>History</span>
                  <span className="text-[10px] bg-surface-3 border border-surface-border text-stone-500 rounded-full px-1.5 py-0.5">
                    {history.length}
                  </span>
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {history.map((entry, i) => (
                    <li
                      key={i}
                      className="flex justify-between items-center bg-surface-1 border border-surface-border rounded-xl px-3 py-2 text-sm"
                    >
                      <span className="text-stone-300 truncate mr-2">"{entry.transcript}"</span>
                      <span className={`shrink-0 text-xs font-medium ${entry.command ? "text-primary-400" : "text-rose-400"}`}>
                        {entry.command ?? "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>

          {/* RIGHT — commands reference */}
          <div className="flex-1 min-w-0 pb-nav">
            <SectionLabel label="Available commands" className="mb-4" />
            <div className="space-y-5">
              {Object.entries(groupedCommands).map(([module, cmds]) => (
                <section key={module} aria-label={`${moduleLabels[module] ?? module} commands`}>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-primary-400 mb-2">
                    {moduleLabels[module] ?? module}
                  </p>
                  <ul className="space-y-1.5">
                    {cmds.map((cmd) => (
                      <li
                        key={cmd.name}
                        className="flex justify-between items-center bg-surface-1 border border-surface-border rounded-xl px-4 py-3 min-h-touch"
                      >
                        <span className="text-stone-100 font-medium text-sm">
                          "{cmd.patterns[0]}"
                        </span>
                        <span className="text-stone-300 text-xs ml-4 text-right">{cmd.description}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
              <p className="text-xs text-stone-500 pt-2">
                You can also ask questions — "what is this", "how do I use the reader", "take a tour".
              </p>
            </div>
          </div>

        </div>
      </div>
    </PageShell>
  );
}
