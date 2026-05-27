// Tactile Drill page — runs the six "Test tasks" from prototype-architecture.md:
// letter ID, short word, numbers/punctuation, navigation forward/back, repeat
// current cell, and a speech-vs-tactile mode toggle. The page reuses the same
// Grade 1 debug translator + braille cells the Tactile Lab uses so a learner
// can drill before plugging in a real device.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import {
  IconArrowLeft,
  IconBraille,
  IconRefresh,
  IconSkipBack,
  IconSkipForward,
} from "@/components/Icons";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { translateGrade1Debug } from "./brailleFrames";
import {
  accuracyPercent,
  nextPrompt,
  scoreAttempt,
  type DrillMode,
  type DrillPrompt,
} from "./drillState";
import { useTactileStore, type DrillSpeechMode } from "./tactileStore";

const MODE_OPTIONS: Array<{ id: DrillMode; label: string }> = [
  { id: "letter", label: "Letters" },
  { id: "word", label: "Words" },
  { id: "number", label: "Numbers" },
  { id: "mixed", label: "Mixed" },
];

const SPEECH_OPTIONS: Array<{ id: DrillSpeechMode; label: string; hint: string }> = [
  { id: "silent", label: "Tactile only", hint: "No speech. Read the dots only." },
  { id: "speech", label: "Speech only", hint: "Speak the answer; no dots." },
  { id: "speech+tactile", label: "Speech + tactile", hint: "Speak after a delay." },
];

export default function TactileDrillPage() {
  const navigate = useNavigate();
  const announce = useAnnounce();

  // Persisted across reloads via tactileStore.
  const mode = useTactileStore((s) => s.drillMode);
  const setMode = useTactileStore((s) => s.setDrillMode);
  const speechMode = useTactileStore((s) => s.drillSpeechMode);
  const setSpeechMode = useTactileStore((s) => s.setDrillSpeechMode);
  const score = useTactileStore((s) => s.drillScore);
  const setScoreStored = useTactileStore((s) => s.setDrillScore);
  const resetDrillScore = useTactileStore((s) => s.resetDrillScore);

  // Transient — derived per session.
  const [history, setHistory] = useState<DrillPrompt[]>(() => [nextPrompt(mode)]);
  const [cursor, setCursor] = useState(0);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const current = history[cursor]!;
  const cells = useMemo(() => translateGrade1Debug(current.answer), [current.answer]);
  const braillePreview = cells.map((c) => c.unicode).join("");

  // Mode change → fresh prompt list so old letter cards don't mix into a word
  // drill. We keep the score so the learner can compare modes if they like.
  useEffect(() => {
    setHistory([nextPrompt(mode)]);
    setCursor(0);
    setGuess("");
    setFeedback("idle");
  }, [mode]);

  // Speak the prompt depending on speech mode. We delay slightly for the
  // "speech+tactile" combo so the dots can be felt first.
  useEffect(() => {
    if (speechMode === "silent") return;
    const delay = speechMode === "speech+tactile" ? 1200 : 0;
    const id = window.setTimeout(() => {
      speechEngine.interrupt(`${current.kind}. ${current.answer}`);
    }, delay);
    return () => window.clearTimeout(id);
  }, [current, speechMode]);

  const submit = useCallback(() => {
    if (guess.trim().length === 0) return;
    const { next, correct } = scoreAttempt(score, current.answer, guess);
    setScoreStored(next);
    setFeedback(correct ? "correct" : "wrong");
    const accuracy = accuracyPercent(next);
    const message = correct
      ? `Correct. ${next.streak} in a row. ${accuracy} percent accuracy.`
      : `Not quite. The answer was ${current.answer}.`;
    announce(message);
    speechEngine.interrupt(message);
  }, [announce, current.answer, guess, score, setScoreStored]);

  const advance = useCallback(() => {
    setHistory((prev) => {
      // If the learner is mid-history (after pressing Back), drop the future
      // so a new sequence starts from here. Matches how a tape recorder works.
      const trimmed = prev.slice(0, cursor + 1);
      return [...trimmed, nextPrompt(mode)];
    });
    setCursor((c) => c + 1);
    setGuess("");
    setFeedback("idle");
    inputRef.current?.focus();
  }, [cursor, mode]);

  const goBack = useCallback(() => {
    if (cursor === 0) return;
    setCursor(cursor - 1);
    setGuess("");
    setFeedback("idle");
  }, [cursor]);

  const repeat = useCallback(() => {
    // The doc lists "repeat current cell" as a test task. We pulse the live
    // region so a screen reader re-reads the prompt cue, and re-trigger
    // speech if we're in a speech mode.
    announce(`Repeat: ${current.kind}. ${cells.length} cells.`);
    if (speechMode !== "silent") {
      speechEngine.interrupt(current.answer);
    }
  }, [announce, cells.length, current, speechMode]);

  const reset = useCallback(() => {
    resetDrillScore();
    setHistory([nextPrompt(mode)]);
    setCursor(0);
    setGuess("");
    setFeedback("idle");
    announce("Drill reset. Score cleared.");
  }, [announce, mode, resetDrillScore]);

  useEffect(() => {
    announce(
      "Tactile drill. Pick a mode, feel or read the dots, then type what you think it is."
    );
    inputRef.current?.focus();
  }, [announce]);

  const accuracy = accuracyPercent(score);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button variant="ghost" onClick={() => navigate("/")} aria-label="Go back to home">
            <IconArrowLeft className="w-5 h-5 inline mr-1" /> Back
          </Button>
          <h1 className="text-lg font-bold text-white">Tactile Drill</h1>
          <div className="w-20 text-right text-sm text-gray-400" aria-hidden="true">
            {score.attempts > 0 ? `${accuracy}%` : ""}
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 py-5 pb-28 max-w-lg mx-auto w-full space-y-6">
        <section aria-labelledby="drill-mode-heading">
          <h2 id="drill-mode-heading" className="text-lg font-semibold text-white mb-3">
            Drill
          </h2>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Drill mode">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={mode === option.id}
                onClick={() => setMode(option.id)}
                className={`min-h-touch rounded-lg border px-2 py-2 font-semibold text-sm ${
                  mode === option.id
                    ? "bg-primary-600 border-primary-300 text-white"
                    : "bg-gray-900 border-gray-700 text-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="speech-mode-heading">
          <h2 id="speech-mode-heading" className="text-lg font-semibold text-white mb-3">
            Speech mode
          </h2>
          <div
            className="grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-label="Speech mode"
            aria-describedby="speech-hint"
          >
            {SPEECH_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={speechMode === option.id}
                onClick={() => setSpeechMode(option.id)}
                className={`min-h-touch rounded-lg border px-2 py-2 font-semibold text-sm ${
                  speechMode === option.id
                    ? "bg-primary-600 border-primary-300 text-white"
                    : "bg-gray-900 border-gray-700 text-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {/* One stable element holds the hint for the currently-selected mode.
              Putting aria-describedby on the radiogroup itself keeps the
              reference valid as the user cycles through options, instead of
              dangling at the IDs of the non-selected buttons. */}
          <p id="speech-hint" className="text-sm text-gray-300 mt-2">
            {SPEECH_OPTIONS.find((o) => o.id === speechMode)!.hint}
          </p>
        </section>

        <section aria-labelledby="prompt-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="prompt-heading" className="text-lg font-semibold text-white">
              Prompt
            </h2>
            <span className="text-xs text-gray-400">{current.kind}</span>
          </div>

          <div
            className="bg-gray-950 border border-gray-700 rounded-xl p-4 text-center"
            aria-label={
              speechMode === "speech"
                ? `Current prompt is a ${current.kind}. Tactile output hidden in speech-only mode.`
                : `Current prompt is a ${current.kind} with ${cells.length} braille cells.`
            }
          >
            {speechMode === "speech" ? (
              // Hide the dot preview so a sighted observer using the page as
              // a tactile proxy doesn't get the answer for free — that's the
              // whole point of the "speech only vs speech + tactile"
              // comparison the architecture doc calls out.
              <p
                className="text-base text-gray-400 py-6"
                data-testid="speech-only-hidden"
              >
                Tactile output hidden in speech-only mode.
              </p>
            ) : (
              <p className="text-5xl leading-relaxed break-words" lang="zxx">
                {braillePreview}
              </p>
            )}
            <p className="text-xs text-gray-400 mt-3" data-testid="cells-debug">
              {cells.length} cells
            </p>
          </div>
        </section>

        <section aria-labelledby="answer-heading">
          <h2 id="answer-heading" className="text-lg font-semibold text-white mb-3">
            Your answer
          </h2>
          <label htmlFor="drill-input" className="sr-only">
            Type the {current.kind} you read in the dots above
          </label>
          <input
            id="drill-input"
            ref={inputRef}
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (feedback === "idle") {
                  submit();
                } else {
                  advance();
                }
              }
            }}
            className="w-full bg-gray-900 text-white border border-gray-700 rounded-xl px-4 py-3 text-lg"
            aria-describedby="drill-feedback"
          />
          <p
            id="drill-feedback"
            role="status"
            aria-live="polite"
            className={`mt-2 text-sm min-h-[1.5rem] ${
              feedback === "correct"
                ? "text-green-300"
                : feedback === "wrong"
                  ? "text-red-300"
                  : "text-gray-400"
            }`}
          >
            {feedback === "correct" && `Correct. Streak ${score.streak}.`}
            {feedback === "wrong" && `Answer was: ${current.answer}.`}
            {feedback === "idle" && "Press Enter to check."}
          </p>
        </section>

        <section aria-labelledby="score-heading" className="grid grid-cols-3 gap-3">
          <h2 id="score-heading" className="sr-only">
            Score
          </h2>
          <ScoreTile label="Attempts" value={score.attempts} />
          <ScoreTile label="Correct" value={score.correct} />
          <ScoreTile label="Streak" value={score.streak} />
        </section>
      </div>

      <div className="fixed bottom-16 left-0 right-0 bg-gray-900/95 backdrop-blur border-t border-gray-700 px-4 py-3">
        <div className="max-w-lg mx-auto grid grid-cols-4 gap-2">
          <Button variant="ghost" onClick={goBack} aria-label="Previous prompt">
            <IconSkipBack className="w-5 h-5" />
          </Button>
          <Button variant="secondary" onClick={repeat} aria-label="Repeat current prompt">
            <IconBraille className="w-5 h-5" />
          </Button>
          <Button onClick={advance} aria-label="Next prompt">
            <IconSkipForward className="w-5 h-5" />
          </Button>
          <Button variant="ghost" onClick={reset} aria-label="Reset score">
            <IconRefresh className="w-5 h-5" />
          </Button>
        </div>
        <p className="max-w-lg mx-auto text-center text-xs text-gray-400 mt-2">
          Enter: check / next. Use the row above for back, repeat, next, reset.
        </p>
      </div>
    </div>
  );
}

function ScoreTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-center">
      <span className="text-gray-400 block text-xs uppercase tracking-wide">{label}</span>
      <span className="text-white text-2xl font-bold">{value}</span>
    </div>
  );
}
