import { describe, expect, it } from "vitest";
import {
  INITIAL_SCORE,
  accuracyPercent,
  nextPrompt,
  scoreAttempt,
} from "./drillState";

// A seeded RNG so the prompt picker is deterministic in tests. Math.random
// would make the assertions brittle.
function seededRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

describe("nextPrompt", () => {
  it("returns a single letter for letter mode", () => {
    const prompt = nextPrompt("letter", seededRng(1));
    expect(prompt.answer).toMatch(/^[a-z]$/);
    expect(prompt.kind).toBe("single letter");
  });

  it("returns a short word for word mode", () => {
    const prompt = nextPrompt("word", seededRng(7));
    expect(prompt.answer.length).toBeGreaterThanOrEqual(3);
    expect(prompt.answer).toMatch(/^[a-z]+$/);
    expect(prompt.kind).toBe("short word");
  });

  it("returns a number 1-99 for number mode", () => {
    for (let seed = 0; seed < 30; seed++) {
      const prompt = nextPrompt("number", seededRng(seed));
      const n = Number(prompt.answer);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(99);
    }
  });

  it("mixes prompt kinds across calls in mixed mode", () => {
    const rng = seededRng(42);
    const kinds = new Set<string>();
    for (let i = 0; i < 20; i++) {
      kinds.add(nextPrompt("mixed", rng).kind);
    }
    // Over 20 draws, we should have hit at least 2 of the 3 categories.
    expect(kinds.size).toBeGreaterThanOrEqual(2);
  });
});

describe("scoreAttempt", () => {
  it("counts a correct attempt and bumps the streak", () => {
    const { next, correct } = scoreAttempt(INITIAL_SCORE, "cat", "Cat");
    expect(correct).toBe(true);
    expect(next).toEqual({ attempts: 1, correct: 1, streak: 1 });
  });

  it("resets the streak on a wrong guess but still counts the attempt", () => {
    const after1 = scoreAttempt(INITIAL_SCORE, "dog", "dog").next;
    const after2 = scoreAttempt(after1, "cat", "cot");
    expect(after2.correct).toBe(false);
    expect(after2.next).toEqual({ attempts: 2, correct: 1, streak: 0 });
  });

  it("treats whitespace and case as insignificant", () => {
    expect(scoreAttempt(INITIAL_SCORE, "moon", "  MOON  ").correct).toBe(true);
  });
});

describe("accuracyPercent", () => {
  it("returns 0 when no attempts have been made", () => {
    expect(accuracyPercent(INITIAL_SCORE)).toBe(0);
  });

  it("rounds to the nearest whole percent", () => {
    expect(accuracyPercent({ attempts: 3, correct: 2, streak: 2 })).toBe(67);
    expect(accuracyPercent({ attempts: 4, correct: 1, streak: 0 })).toBe(25);
  });
});
