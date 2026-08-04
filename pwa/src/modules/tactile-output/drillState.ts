// Pure logic powering the drill page. Kept separate from the React component
// so the prompt generator and scoring code can be unit-tested without rendering
// anything — the doc's six "Test tasks" rely on this being correct.

export type DrillMode = "letter" | "word" | "number" | "punctuation" | "mixed";
export type Difficulty = "easy" | "normal" | "hard";

export interface DrillPrompt {
  // What the learner is supposed to identify.
  answer: string;
  // Short, screen-reader friendly label, e.g. "single letter" or "three-letter word".
  kind: string;
}

export interface DrillScore {
  attempts: number;
  correct: number;
  streak: number;
}

export interface DrillAttempt {
  answer: string;
  kind: string;
  guess: string;
  correct: boolean;
  at: number;
  mode?: DrillMode;
  difficulty?: Difficulty;
  speechMode?: string;
  responseTimeMs?: number;
}

export const INITIAL_SCORE: DrillScore = { attempts: 0, correct: 0, streak: 0 };

// Cap on retained history. Stored in localStorage via tactileStore, so it
// also indirectly bounds the persisted payload size.
export const MAX_HISTORY = 100;

// Letter pools per difficulty. "Easy" uses the simplest braille cells
// (mask 1-5 = single dot in top row through a-e plus their pair extensions);
// "normal" matches the previous behaviour; "hard" exposes the full alphabet,
// including the awkward dot patterns the learner hasn't met before.
const LETTERS_BY_DIFFICULTY: Record<Difficulty, string[]> = {
  easy: "abcdefghij".split(""),
  normal: "abcdefghijklmnoprstuvwy".split(""),
  hard: "abcdefghijklmnopqrstuvwxyz".split(""),
};

// Word pools per difficulty. All entries map cleanly in Grade 1 debug — no
// contractions or diacritics — so the learner can compare what they read
// against what they typed without a third translator in the loop.
const WORDS_BY_DIFFICULTY: Record<Difficulty, string[]> = {
  easy: ["cat", "dog", "sun", "key", "red", "ten"],
  normal: [
    "cat", "dog", "sun", "moon", "book", "tree", "lamp", "rain", "snow",
    "blue", "red", "green", "hand", "foot", "door", "key", "fire", "water",
  ],
  hard: [
    "umbrella", "telephone", "kitchen", "morning", "highway", "elephant",
    "computer", "blanket", "yesterday", "tomorrow", "treehouse",
  ],
};

// Number range per difficulty, expressed as half-open [min, max+1).
const NUMBER_RANGE_BY_DIFFICULTY: Record<Difficulty, [number, number]> = {
  easy: [1, 10],
  normal: [1, 100],
  hard: [1, 1000],
};

// Punctuation marks the Grade 1 debug translator can render.
// translateGrade1Debug maps these to dot masks directly.
const PUNCTUATION_BY_DIFFICULTY: Record<Difficulty, string[]> = {
  easy: [".", ",", "!"],
  normal: [".", ",", ";", ":", "!", "?"],
  hard: [".", ",", ";", ":", "!", "?", "-", "'"],
};

function pick<T>(items: readonly T[], rng: () => number): T {
  if (items.length === 0) throw new Error("Cannot pick from empty list.");
  const idx = Math.floor(rng() * items.length) % items.length;
  return items[idx]!;
}

function pickInRange(range: readonly [number, number], rng: () => number): number {
  const [min, max] = range;
  const span = max - min;
  return min + (Math.floor(rng() * span) % span);
}

export function nextPrompt(
  mode: DrillMode,
  rng: () => number = Math.random,
  difficulty: Difficulty = "normal"
): DrillPrompt {
  switch (mode) {
    case "letter":
      return {
        answer: pick(LETTERS_BY_DIFFICULTY[difficulty], rng),
        kind: "single letter",
      };
    case "word":
      return {
        answer: pick(WORDS_BY_DIFFICULTY[difficulty], rng),
        kind: difficulty === "hard" ? "long word" : "short word",
      };
    case "number":
      return {
        answer: String(pickInRange(NUMBER_RANGE_BY_DIFFICULTY[difficulty], rng)),
        kind: "number",
      };
    case "punctuation":
      return {
        answer: pick(PUNCTUATION_BY_DIFFICULTY[difficulty], rng),
        kind: "punctuation mark",
      };
    case "mixed": {
      const which = Math.floor(rng() * 4);
      if (which === 0) return nextPrompt("letter", rng, difficulty);
      if (which === 1) return nextPrompt("word", rng, difficulty);
      if (which === 2) return nextPrompt("number", rng, difficulty);
      return nextPrompt("punctuation", rng, difficulty);
    }
  }
}

export function scoreAttempt(score: DrillScore, expected: string, guess: string): {
  next: DrillScore;
  correct: boolean;
} {
  const correct = normalizeGuess(expected) === normalizeGuess(guess);
  return {
    correct,
    next: {
      attempts: score.attempts + 1,
      correct: score.correct + (correct ? 1 : 0),
      streak: correct ? score.streak + 1 : 0,
    },
  };
}

export function accuracyPercent(score: DrillScore): number {
  if (score.attempts === 0) return 0;
  return Math.round((score.correct / score.attempts) * 100);
}

// Newest first; truncate so the persisted blob stays bounded.
export function recordAttempt(
  history: readonly DrillAttempt[],
  attempt: DrillAttempt
): DrillAttempt[] {
  return [attempt, ...history].slice(0, MAX_HISTORY);
}

// CSV serialiser used by the "Export" button. Header is fixed so a spreadsheet
// or a future analytics tool can rely on the columns. Quoting follows RFC 4180.
export function historyToCsv(history: readonly DrillAttempt[]): string {
  const header =
    "at_iso,mode,difficulty,speech_mode,prompt_kind,expected_answer,user_answer,correct,response_time_ms";
  const rows = history.map((a) =>
    [
      new Date(a.at).toISOString(),
      csvEscape(a.mode ?? ""),
      csvEscape(a.difficulty ?? ""),
      csvEscape(a.speechMode ?? ""),
      csvEscape(a.kind),
      csvEscape(a.answer),
      csvEscape(a.guess),
      a.correct ? "1" : "0",
      typeof a.responseTimeMs === "number" ? String(Math.max(0, Math.round(a.responseTimeMs))) : "",
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

function csvEscape(value: string): string {
  // Anything containing a delimiter, a quote, or a newline gets wrapped in
  // double quotes with internal quotes doubled. Everything else passes
  // through untouched — keeps the common case readable.
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Punctuation prompts are single characters; reading them back as e.g. ";"
// is ambiguous in a screen-reader context, so the drill page calls this to
// substitute a human-readable name when announcing the answer.
const PUNCTUATION_NAMES: Record<string, string> = {
  ".": "period",
  ",": "comma",
  ";": "semicolon",
  ":": "colon",
  "!": "exclamation mark",
  "?": "question mark",
  "-": "hyphen",
  "'": "apostrophe",
};

export function spokenAnswer(prompt: DrillPrompt): string {
  if (prompt.kind === "punctuation mark") {
    return PUNCTUATION_NAMES[prompt.answer] ?? prompt.answer;
  }
  return prompt.answer;
}

function normalizeGuess(value: string): string {
  return value.trim().toLowerCase();
}

// Per-answer accuracy aggregation. The map is keyed by the answer string
// so callers can sort by "weakest" (lowest accuracy) and drill those first.
// Kept in drillState (not the component) so it stays unit-testable.
export interface AnswerStats {
  answer: string;
  kind: string;
  attempts: number;
  correct: number;
  // Most recent attempt timestamp — used to break ties and keep ordering
  // deterministic when several answers have the same accuracy.
  lastAt: number;
}

export function perAnswerStats(history: readonly DrillAttempt[]): AnswerStats[] {
  const byKey = new Map<string, AnswerStats>();
  for (const a of history) {
    const existing = byKey.get(a.answer);
    if (existing) {
      existing.attempts += 1;
      existing.correct += a.correct ? 1 : 0;
      if (a.at > existing.lastAt) existing.lastAt = a.at;
    } else {
      byKey.set(a.answer, {
        answer: a.answer,
        kind: a.kind,
        attempts: 1,
        correct: a.correct ? 1 : 0,
        lastAt: a.at,
      });
    }
  }
  return [...byKey.values()];
}

// Surface the answers the learner has actually gotten wrong, sorted by
// "most pain first": lowest accuracy, then most recent. Used to seed the
// mistakes-mode pool so a quick session lands on real weak spots, not
// answers the learner has already mastered.
export function mistakePool(history: readonly DrillAttempt[]): AnswerStats[] {
  return perAnswerStats(history)
    .filter((s) => s.correct < s.attempts)
    .sort((a, b) => {
      const accA = a.correct / a.attempts;
      const accB = b.correct / b.attempts;
      if (accA !== accB) return accA - accB;
      return b.lastAt - a.lastAt;
    });
}

// Pick a prompt from the mistake pool. Returns null when the pool is empty
// so the caller can fall back to the regular generator instead of silently
// repeating the same answer.
export function nextMistakePrompt(
  history: readonly DrillAttempt[],
  rng: () => number = Math.random
): DrillPrompt | null {
  const pool = mistakePool(history);
  if (pool.length === 0) return null;
  const choice = pick(pool, rng);
  return { answer: choice.answer, kind: choice.kind };
}

// Fold the history by speech mode so a learner can see whether adding
// tactile output changed accuracy or speed. Only modes that actually have
// attempts appear; rows sort by accuracy so the weaker reading mode shows
// first. Every attempt already records speechMode, so no new persistence is
// needed — this is pure aggregation on the existing history.
export interface SpeechModeStats {
  speechMode: string;
  attempts: number;
  correct: number;
  accuracyPercent: number;
  // Average response time across attempts that recorded one; null when none
  // of the attempts in this mode have a response time.
  avgResponseTimeMs: number | null;
}

export function perSpeechModeStats(history: readonly DrillAttempt[]): SpeechModeStats[] {
  const byMode = new Map<string, { attempts: number; correct: number; responseSum: number; responseCount: number }>();
  for (const attempt of history) {
    if (!attempt.speechMode) continue;
    const existing = byMode.get(attempt.speechMode);
    const responseTime = typeof attempt.responseTimeMs === "number" ? attempt.responseTimeMs : null;
    if (existing) {
      existing.attempts += 1;
      existing.correct += attempt.correct ? 1 : 0;
      if (responseTime !== null) {
        existing.responseSum += responseTime;
        existing.responseCount += 1;
      }
    } else {
      byMode.set(attempt.speechMode, {
        attempts: 1,
        correct: attempt.correct ? 1 : 0,
        responseSum: responseTime ?? 0,
        responseCount: responseTime === null ? 0 : 1,
      });
    }
  }
  return [...byMode.entries()]
    .map(([speechMode, stats]) => ({
      speechMode,
      attempts: stats.attempts,
      correct: stats.correct,
      accuracyPercent: Math.round((stats.correct / stats.attempts) * 100),
      avgResponseTimeMs:
        stats.responseCount > 0 ? Math.round(stats.responseSum / stats.responseCount) : null,
    }))
    .sort((a, b) => a.accuracyPercent - b.accuracyPercent);
}

// Extended CSV: same per-attempt rows, then a blank line, then a per-answer
// summary block. A spreadsheet importer treats the second block as a new
// table; for a quick `cat` of the file the learner sees both views.
export function historyToCsvWithSummary(history: readonly DrillAttempt[]): string {
  const head = historyToCsv(history);
  const stats = perAnswerStats(history).sort((a, b) => {
    const accA = a.correct / a.attempts;
    const accB = b.correct / b.attempts;
    return accA - accB;
  });
  if (stats.length === 0) return head;
  const summaryHeader = "answer,kind,attempts,correct,accuracy_percent";
  const summaryRows = stats.map((s) =>
    [
      csvEscape(s.answer),
      csvEscape(s.kind),
      String(s.attempts),
      String(s.correct),
      String(Math.round((s.correct / s.attempts) * 100)),
    ].join(",")
  );
  const parts = [head, "", summaryHeader, ...summaryRows];
  const modes = perSpeechModeStats(history);
  if (modes.length >= 2) {
    const modeHeader = "speech_mode,attempts,correct,accuracy_percent,avg_response_time_ms";
    const modeRows = modes.map((m) =>
      [
        csvEscape(m.speechMode),
        String(m.attempts),
        String(m.correct),
        String(m.accuracyPercent),
        m.avgResponseTimeMs === null ? "" : String(m.avgResponseTimeMs),
      ].join(",")
    );
    parts.push("", modeHeader, ...modeRows);
  }
  return parts.join("\n");
}
