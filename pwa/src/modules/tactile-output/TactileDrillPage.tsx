// Tactile Drill page — runs the six "Test tasks" from prototype-architecture.md:
// letter ID, short word, numbers/punctuation, navigation forward/back, repeat
// current cell, and a speech-vs-tactile mode toggle. The page reuses the same
// Grade 1 debug translator + braille cells the Tactile Lab uses so a learner
// can drill before plugging in a real device.

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/Button";
import { PageShell, toggleActive, toggleInactive } from "@/components/PageShell";
import {
  IconBraille,
  IconRefresh,
  IconSkipBack,
  IconSkipForward,
} from "@/components/Icons";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { detectSpeechSynthesis } from "@/core/utils/capabilities";
import { translateGrade1Debug } from "./brailleFrames";
import {
  accuracyPercent,
  historyToCsvWithSummary,
  mistakePool,
  nextMistakePrompt,
  nextPrompt,
  perSpeechModeStats,
  scoreAttempt,
  spokenAnswer,
  type Difficulty,
  type DrillMode,
  type DrillPrompt,
} from "./drillState";
import { useTactileStore, type DrillSpeechMode } from "./tactileStore";
import {
  MODULE_VOICE_ACTION_EVENT,
  takePendingVoiceAction,
  type VoiceAction,
} from "@/modules/voice-nav/voiceActions";

const MODE_OPTIONS: Array<{ id: DrillMode; label: string }> = [
  { id: "letter", label: "Letters" },
  { id: "word", label: "Words" },
  { id: "number", label: "Numbers" },
  { id: "punctuation", label: "Punctuation" },
  { id: "mixed", label: "Mixed" },
];

const SPEECH_OPTIONS: Array<{ id: DrillSpeechMode; label: string; hint: string }> = [
  { id: "silent", label: "Tactile only", hint: "No speech. Read the dots only." },
  { id: "speech", label: "Speech only", hint: "Speak the answer; no dots." },
  { id: "speech+tactile", label: "Speech + tactile", hint: "Speak after a delay." },
];

const DIFFICULTY_OPTIONS: Array<{ id: Difficulty; label: string; hint: string }> = [
  { id: "easy", label: "Easy", hint: "First ten letters, three-letter words, single digits." },
  { id: "normal", label: "Normal", hint: "Most letters, mixed word lengths, 1–99." },
  { id: "hard", label: "Hard", hint: "Full alphabet, longer words, 1–999, more punctuation." },
];

function moveRadioSelection<T extends string>(
  event: KeyboardEvent<HTMLElement>,
  options: readonly { id: T }[],
  current: T,
  select: (next: T) => void
) {
  const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
  const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
  const first = event.key === "Home";
  const last = event.key === "End";
  if (!forward && !backward && !first && !last) return;

  event.preventDefault();
  const currentIndex = Math.max(0, options.findIndex((option) => option.id === current));
  const nextIndex = first
    ? 0
    : last
      ? options.length - 1
      : forward
        ? (currentIndex + 1) % options.length
        : (currentIndex - 1 + options.length) % options.length;
  const next = options[nextIndex]!.id;
  select(next);
  window.setTimeout(() => {
    const target = document.querySelector<HTMLElement>(`[data-radio-value="${next}"]`);
    target?.focus();
  }, 0);
}

export default function TactileDrillPage() {
  const announce = useAnnounce();
  const location = useLocation();

  // Persisted across reloads via tactileStore.
  const mode = useTactileStore((s) => s.drillMode);
  const setMode = useTactileStore((s) => s.setDrillMode);
  const speechMode = useTactileStore((s) => s.drillSpeechMode);
  const setSpeechMode = useTactileStore((s) => s.setDrillSpeechMode);
  const score = useTactileStore((s) => s.drillScore);
  const setScoreStored = useTactileStore((s) => s.setDrillScore);
  const difficulty = useTactileStore((s) => s.drillDifficulty);
  const setDifficulty = useTactileStore((s) => s.setDrillDifficulty);
  const attemptHistory = useTactileStore((s) => s.drillHistory);
  const pushDrillAttempt = useTactileStore((s) => s.pushDrillAttempt);
  const resetDrillScore = useTactileStore((s) => s.resetDrillScore);

  // Practice-mistakes mode is transient (session-local) on purpose — the
  // learner should consciously opt in each session. Auto-resuming it would
  // be frustrating after a long break: you'd come back to the app and only
  // get drilled on old mistakes instead of getting fresh practice.
  const [practiceMistakes, setPracticeMistakes] = useState(false);

  // The set of mistake answers at the moment the user toggled the mode on.
  // We snapshot the pool so the queue is stable for the session — otherwise
  // every correct answer would shrink the pool mid-session and the user
  // would mysteriously stop seeing letters they were just drilling.
  const mistakeStats = useMemo(() => mistakePool(attemptHistory), [attemptHistory]);

  // Build the next prompt either from the mistake pool (when on) or the
  // regular generator. Falls back to the regular generator when the pool
  // is exhausted, so the drill never deadlocks.
  const buildNextPrompt = useCallback((): DrillPrompt => {
    if (practiceMistakes) {
      const fromMistakes = nextMistakePrompt(attemptHistory);
      if (fromMistakes) return fromMistakes;
    }
    return nextPrompt(mode, undefined, difficulty);
  }, [practiceMistakes, attemptHistory, mode, difficulty]);

  // Transient — derived per session.
  const [history, setHistory] = useState<DrillPrompt[]>(() => [nextPrompt(mode, undefined, difficulty)]);
  const [cursor, setCursor] = useState(0);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<"idle" | "correct" | "wrong">("idle");
  const [promptStartedAt, setPromptStartedAt] = useState(() => Date.now());
  const inputRef = useRef<HTMLInputElement | null>(null);

  const current = history[cursor]!;
  const cells = useMemo(() => translateGrade1Debug(current.answer), [current.answer]);
  const braillePreview = cells.map((c) => c.unicode).join("");
  // Detected once per mount; the speech engine doesn't appear or disappear
  // mid-session, so re-probing on every render would be wasted work.
  const speechCap = useMemo(() => detectSpeechSynthesis(), []);
  const speechNeeded = speechMode !== "silent";

  // Mode or difficulty change → fresh prompt list so old letter cards don't
  // mix into a word drill, and the new pool kicks in immediately. We keep
  // the score so the learner can compare runs if they like.
  useEffect(() => {
    setHistory([buildNextPrompt()]);
    setCursor(0);
    setGuess("");
    setFeedback("idle");
    setPromptStartedAt(Date.now());
    // Intentionally exclude buildNextPrompt from deps — it changes on every
    // attempt as attemptHistory grows, which would re-trigger this effect
    // mid-session and reset the cursor. Only mode/difficulty/practiceMistakes
    // should reset the queue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, difficulty, practiceMistakes]);

  // Speak the prompt depending on speech mode. We delay slightly for the
  // "speech+tactile" combo so the dots can be felt first.
  useEffect(() => {
    if (speechMode === "silent") return;
    const delay = speechMode === "speech+tactile" ? 1200 : 0;
    const id = window.setTimeout(() => {
      speechEngine.interrupt(`${current.kind}. ${spokenAnswer(current)}`);
    }, delay);
    return () => window.clearTimeout(id);
  }, [current, speechMode]);

  const submit = useCallback(() => {
    if (guess.trim().length === 0) return;
    const submittedAt = Date.now();
    const { next, correct } = scoreAttempt(score, current.answer, guess);
    setScoreStored(next);
    pushDrillAttempt({
      answer: current.answer,
      kind: current.kind,
      guess: guess.trim(),
      correct,
      at: submittedAt,
      mode,
      difficulty,
      speechMode,
      responseTimeMs: submittedAt - promptStartedAt,
    });
    setFeedback(correct ? "correct" : "wrong");
    const accuracy = accuracyPercent(next);
    // Use spokenAnswer for the announcement so punctuation marks read as
    // "semicolon" / "question mark" rather than the raw glyph.
    const spoken = spokenAnswer(current);
    const message = correct
      ? `Correct. ${next.streak} in a row. ${accuracy} percent accuracy.`
      : `Not quite. The answer was ${spoken}.`;
    announce(message);
    speechEngine.interrupt(message);
  }, [
    announce,
    current,
    difficulty,
    guess,
    mode,
    promptStartedAt,
    score,
    setScoreStored,
    speechMode,
    pushDrillAttempt,
  ]);

  const advance = useCallback(() => {
    setHistory((prev) => {
      // If the learner is mid-history (after pressing Back), drop the future
      // so a new sequence starts from here. Matches how a tape recorder works.
      const trimmed = prev.slice(0, cursor + 1);
      return [...trimmed, buildNextPrompt()];
    });
    setCursor((c) => c + 1);
    setGuess("");
    setFeedback("idle");
    setPromptStartedAt(Date.now());
    inputRef.current?.focus();
  }, [cursor, buildNextPrompt]);

  const goBack = useCallback(() => {
    if (cursor === 0) return;
    setCursor(cursor - 1);
    setGuess("");
    setFeedback("idle");
    setPromptStartedAt(Date.now());
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
    setHistory([buildNextPrompt()]);
    setCursor(0);
    setGuess("");
    setFeedback("idle");
    setPromptStartedAt(Date.now());
    announce("Drill reset. Score cleared.");
  }, [announce, buildNextPrompt, resetDrillScore]);

  useEffect(() => {
    function runDrillVoiceAction(action: VoiceAction | undefined) {
      switch (action) {
        case "drill_next":
          advance();
          break;
        case "drill_previous":
          goBack();
          break;
        case "drill_repeat":
          repeat();
          break;
        case "drill_reset":
          reset();
          break;
      }
    }

    function handleVoiceAction(event: Event) {
      runDrillVoiceAction((event as CustomEvent<{ action: VoiceAction }>).detail?.action);
    }

    window.addEventListener(MODULE_VOICE_ACTION_EVENT, handleVoiceAction);
    const pending = takePendingVoiceAction(location.pathname);
    if (pending) window.setTimeout(() => runDrillVoiceAction(pending), 0);
    return () => window.removeEventListener(MODULE_VOICE_ACTION_EVENT, handleVoiceAction);
  }, [advance, goBack, location.pathname, repeat, reset]);

  const exportCsv = useCallback(() => {
    // historyToCsvWithSummary appends a per-answer accuracy block after the
    // raw attempt log. Spreadsheet importers see two tables; `cat` users see
    // both views. The summary is what makes the export actually useful for
    // tracking which symbols still need work.
    const csv = historyToCsvWithSummary(attemptHistory);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tactile-drill-history-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    announce(`Exported ${attemptHistory.length} drill attempts.`);
  }, [announce, attemptHistory]);

  const togglePracticeMistakes = useCallback(() => {
    setPracticeMistakes((on) => {
      const next = !on;
      const poolSize = mistakeStats.length;
      if (next && poolSize === 0) {
        // Don't silently flip the toggle into a no-op state — tell the user
        // there's nothing to practice yet, and leave the toggle off.
        announce("No mistakes yet to practice. Keep drilling first.");
        return false;
      }
      announce(
        next
          ? `Practice mistakes on. ${poolSize} answer${poolSize === 1 ? "" : "s"} in your weakest pool.`
          : "Practice mistakes off. Back to the regular pool."
      );
      return next;
    });
  }, [announce, mistakeStats.length]);

  // Mistakes only — the user already knows what they got right. Showing the
  // last few wrong answers turns the panel into a quick review surface.
  const recentMistakes = useMemo(
    () => attemptHistory.filter((a) => !a.correct).slice(0, 5),
    [attemptHistory]
  );

  // The speech-only vs speech+tactile comparison summary. Only rendered once
  // at least two modes have attempts — with a single mode there is nothing
  // to compare against.
  const speechModeStats = useMemo(() => perSpeechModeStats(attemptHistory), [attemptHistory]);
  const showSpeechComparison = speechModeStats.length >= 2;

  useEffect(() => {
    announce(
      "Tactile drill. Pick a mode, feel or read the dots, then type what you think it is."
    );
    inputRef.current?.focus();
  }, [announce]);

  const accuracy = accuracyPercent(score);

  return (
    <PageShell
      title="Tactile Drill"
      accent="yellow"
      headerRight={
        <div className="text-sm text-stone-400" aria-hidden="true" data-testid="accuracy-chip">{score.attempts > 0 ? `${accuracy}%` : ""}</div>
      }
    >
      <div className="flex-1 px-4 py-5 pb-nav-action max-w-3xl mx-auto w-full space-y-6">
        <section aria-labelledby="drill-mode-heading">
          <h2 id="drill-mode-heading" className="text-lg font-semibold text-white mb-3">
            Drill
          </h2>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label="Drill mode">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={mode === option.id}
                tabIndex={mode === option.id ? 0 : -1}
                data-radio-value={option.id}
                onClick={() => setMode(option.id)}
                onKeyDown={(event) =>
                  moveRadioSelection(event, MODE_OPTIONS, mode, setMode)
                }
                className={`px-1 py-2 text-xs ${
                  mode === option.id ? toggleActive : toggleInactive
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="difficulty-heading">
          <h2 id="difficulty-heading" className="text-lg font-semibold text-white mb-3">
            Difficulty
          </h2>
          <div
            className="grid grid-cols-3 gap-2"
            role="radiogroup"
            aria-label="Drill difficulty"
            aria-describedby="difficulty-hint"
          >
            {DIFFICULTY_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={difficulty === option.id}
                tabIndex={difficulty === option.id ? 0 : -1}
                data-radio-value={option.id}
                onClick={() => setDifficulty(option.id)}
                onKeyDown={(event) =>
                  moveRadioSelection(event, DIFFICULTY_OPTIONS, difficulty, setDifficulty)
                }
                className={`px-3 py-2 text-sm ${
                  difficulty === option.id ? toggleActive : toggleInactive
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p id="difficulty-hint" className="text-sm text-stone-300 mt-2">
            {DIFFICULTY_OPTIONS.find((d) => d.id === difficulty)!.hint}
          </p>
        </section>

        <section aria-labelledby="practice-mistakes-heading">
          <h2 id="practice-mistakes-heading" className="text-lg font-semibold text-white mb-3">
            Practice mistakes
          </h2>
          <button
            type="button"
            role="switch"
            aria-checked={practiceMistakes}
            aria-describedby="practice-mistakes-hint"
            onClick={togglePracticeMistakes}
            data-testid="toggle-practice-mistakes"
            className={`min-h-touch w-full rounded-lg border px-4 py-3 font-semibold text-sm flex items-center justify-between gap-3 ${
              practiceMistakes
                ? "bg-amber-500/15 border-amber-400/40 text-amber-100"
                : "bg-surface-2 border-surface-border text-stone-200"
            }`}
            disabled={!practiceMistakes && mistakeStats.length === 0}
          >
            <span>{practiceMistakes ? "On — drilling your weak spots" : "Off — random prompts"}</span>
            <span className="text-xs text-stone-400" aria-hidden="true">
              {mistakeStats.length} weak
            </span>
          </button>
          <p id="practice-mistakes-hint" className="text-sm text-stone-300 mt-2">
            {mistakeStats.length === 0
              ? "Make at least one wrong guess to build a mistake pool."
              : `Queues only answers you've missed — starts with the ${mistakeStats[0]!.kind === "single letter" ? "letter" : "answer"} "${mistakeStats[0]!.answer}" (your weakest).`}
          </p>
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
                tabIndex={speechMode === option.id ? 0 : -1}
                data-radio-value={option.id}
                onClick={() => setSpeechMode(option.id)}
                onKeyDown={(event) =>
                  moveRadioSelection(event, SPEECH_OPTIONS, speechMode, setSpeechMode)
                }
                className={`px-2 py-2 text-sm ${
                  speechMode === option.id ? toggleActive : toggleInactive
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
          <p id="speech-hint" className="text-sm text-stone-300 mt-2">
            {SPEECH_OPTIONS.find((o) => o.id === speechMode)!.hint}
          </p>
          {speechNeeded && !speechCap.available && (
            <p role="alert" className="text-sm text-yellow-300 mt-2">
              {speechCap.reason} {speechCap.suggestion} The drill will still
              run silently — switch to Tactile only if you don't want the
              warning.
            </p>
          )}
        </section>

        <section aria-labelledby="prompt-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="prompt-heading" className="text-lg font-semibold text-white">
              Prompt
            </h2>
            <span className="text-xs text-stone-400">{current.kind}</span>
          </div>

          <div
            className="bg-surface-1 border border-surface-border rounded-xl p-4 text-center"
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
                className="text-base text-stone-400 py-6"
                data-testid="speech-only-hidden"
              >
                Tactile output hidden in speech-only mode.
              </p>
            ) : (
              <p className="text-5xl leading-relaxed break-words" lang="zxx">
                {braillePreview}
              </p>
            )}
            <p className="text-xs text-stone-400 mt-3" data-testid="cells-debug">
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
            className="w-full bg-surface-2 text-white border border-surface-border rounded-xl px-4 py-3 text-lg"
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
                  : "text-stone-400"
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

        <section aria-labelledby="session-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="session-heading" className="text-lg font-semibold text-white">
              Session
            </h2>
            <Button
              variant="secondary"
              onClick={exportCsv}
              disabled={attemptHistory.length === 0}
              aria-label="Download drill history as CSV"
              data-testid="drill-export-csv"
            >
              Export CSV
            </Button>
          </div>
          <p className="text-sm text-stone-300 mb-3" data-testid="drill-history-count">
            {attemptHistory.length === 0
              ? "No attempts yet. Submit one to start building your history."
              : `${attemptHistory.length} attempt${attemptHistory.length === 1 ? "" : "s"} in this session.`}
          </p>
          {recentMistakes.length > 0 && (
            <>
              <h3 className="text-sm font-semibold text-stone-200 mb-2">Recent mistakes</h3>
              <ul className="space-y-1" aria-label="Recent mistakes">
                {recentMistakes.map((attempt, i) => (
                  <li
                    key={`${attempt.at}-${i}`}
                    className="text-sm text-stone-300 bg-surface-2 border border-surface-border rounded-lg px-3 py-2"
                  >
                    <span className="text-stone-400">{attempt.kind}:</span>{" "}
                    <span className="text-white font-medium">{spokenAnswer(attempt)}</span>
                    <span className="text-stone-400"> — you said </span>
                    <span className="text-red-300">{attempt.guess || "(blank)"}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {showSpeechComparison && (
            <>
              <h3 className="text-sm font-semibold text-stone-200 mb-2">
                Speech-only vs speech + tactile
              </h3>
              <ul className="space-y-1" aria-label="Accuracy by speech mode">
                {speechModeStats.map((stats) => {
                  const label =
                    SPEECH_OPTIONS.find((option) => option.id === stats.speechMode)?.label ??
                    stats.speechMode;
                  return (
                    <li
                      key={stats.speechMode}
                      className="text-sm text-stone-300 bg-surface-2 border border-surface-border rounded-lg px-3 py-2"
                    >
                      <span className="text-white font-medium">{label}</span>
                      <span className="text-stone-400">
                        {" "}
                        — {stats.accuracyPercent}% accuracy, {stats.attempts} attempt
                        {stats.attempts === 1 ? "" : "s"}
                        {stats.avgResponseTimeMs !== null &&
                          `, ${stats.avgResponseTimeMs} ms average response`}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-stone-400 mt-2">
                Compares the same symbol pool across reading modes so you can see which one
                you read fastest and most accurately.
              </p>
            </>
          )}
        </section>
      </div>

      <div className="fixed bottom-above-nav left-0 right-0 bg-surface-0/95 backdrop-blur border-t border-surface-border px-4 py-3">
        <div className="max-w-3xl mx-auto grid grid-cols-4 gap-2">
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
        <p className="max-w-3xl mx-auto text-center text-xs text-stone-400 mt-2">
          Enter: check / next. Use the row above for back, repeat, next, reset.
        </p>
      </div>
    </PageShell>
  );
}

function ScoreTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface-2 border border-surface-border rounded-lg p-3 text-center">
      <span className="text-stone-400 block text-xs uppercase tracking-wide">{label}</span>
      <span className="text-white text-2xl font-bold">{value}</span>
    </div>
  );
}
