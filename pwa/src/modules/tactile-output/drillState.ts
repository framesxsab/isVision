// Pure logic powering the drill page. Kept separate from the React component
// so the prompt generator and scoring code can be unit-tested without rendering
// anything — the doc's six "Test tasks" rely on this being correct.

export type DrillMode = "letter" | "word" | "number" | "mixed";

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

export const INITIAL_SCORE: DrillScore = { attempts: 0, correct: 0, streak: 0 };

// Plain-English words deliberately chosen so the Grade 1 debug translator
// produces unambiguous cells. No contractions, no diacritics.
const SHORT_WORDS = [
  "cat", "dog", "sun", "moon", "book", "tree", "lamp", "rain", "snow",
  "blue", "red", "green", "hand", "foot", "door", "key", "fire", "water",
];

// Letters that map cleanly in Grade 1 debug. We exclude letters whose dot
// patterns the user is unlikely to see on first contact (q, x, z) — they can
// still show up in word/mixed modes.
const STARTER_LETTERS = "abcdefghijklmnoprstuvwy".split("");

function pick<T>(items: readonly T[], rng: () => number): T {
  if (items.length === 0) throw new Error("Cannot pick from empty list.");
  const idx = Math.floor(rng() * items.length) % items.length;
  return items[idx]!;
}

export function nextPrompt(mode: DrillMode, rng: () => number = Math.random): DrillPrompt {
  switch (mode) {
    case "letter":
      return { answer: pick(STARTER_LETTERS, rng), kind: "single letter" };
    case "word":
      return { answer: pick(SHORT_WORDS, rng), kind: "short word" };
    case "number": {
      // Numbers 1-99 cover the number-sign + digit pattern without overflowing.
      // Using modulo before the +1 protects against rng() === 1.0 (Math.random
      // never returns it, but seeded RNGs can, and TypeScript's number type
      // allows it).
      const value = (Math.floor(rng() * 99) % 99) + 1;
      return { answer: String(value), kind: "number" };
    }
    case "mixed": {
      const which = Math.floor(rng() * 3);
      if (which === 0) return nextPrompt("letter", rng);
      if (which === 1) return nextPrompt("word", rng);
      return nextPrompt("number", rng);
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

function normalizeGuess(value: string): string {
  return value.trim().toLowerCase();
}
