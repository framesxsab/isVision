import { describe, expect, it } from "vitest";
import {
  INITIAL_SCORE,
  MAX_HISTORY,
  accuracyPercent,
  historyToCsv,
  nextPrompt,
  perSpeechModeStats,
  recordAttempt,
  scoreAttempt,
  spokenAnswer,
  type DrillAttempt,
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

  it("uses the easy letter pool when difficulty is easy", () => {
    // Easy = a..j only. Sample many seeds; none should produce a letter
    // outside that pool.
    for (let seed = 0; seed < 50; seed++) {
      const prompt = nextPrompt("letter", seededRng(seed), "easy");
      expect("abcdefghij").toContain(prompt.answer);
    }
  });

  it("returns a short word for word mode", () => {
    const prompt = nextPrompt("word", seededRng(7));
    expect(prompt.answer.length).toBeGreaterThanOrEqual(3);
    expect(prompt.answer).toMatch(/^[a-z]+$/);
    expect(prompt.kind).toBe("short word");
  });

  it("labels hard-difficulty words as 'long word'", () => {
    const prompt = nextPrompt("word", seededRng(2), "hard");
    expect(prompt.kind).toBe("long word");
    expect(prompt.answer.length).toBeGreaterThanOrEqual(6);
  });

  it("returns a number 1-99 for number mode at default difficulty", () => {
    for (let seed = 0; seed < 30; seed++) {
      const prompt = nextPrompt("number", seededRng(seed));
      const n = Number(prompt.answer);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(99);
    }
  });

  it("narrows numbers to 1-9 on easy and widens to 1-999 on hard", () => {
    for (let seed = 0; seed < 20; seed++) {
      const easy = Number(nextPrompt("number", seededRng(seed), "easy").answer);
      expect(easy).toBeGreaterThanOrEqual(1);
      expect(easy).toBeLessThanOrEqual(9);
      const hard = Number(nextPrompt("number", seededRng(seed), "hard").answer);
      expect(hard).toBeGreaterThanOrEqual(1);
      expect(hard).toBeLessThanOrEqual(999);
    }
  });

  it("returns a punctuation character for punctuation mode", () => {
    const prompt = nextPrompt("punctuation", seededRng(3));
    expect(prompt.kind).toBe("punctuation mark");
    expect(prompt.answer.length).toBe(1);
    expect([".", ",", ";", ":", "!", "?"]).toContain(prompt.answer);
  });

  it("punctuation easy mode is limited to the three most common marks", () => {
    const allowed = [".", ",", "!"];
    for (let seed = 0; seed < 30; seed++) {
      const prompt = nextPrompt("punctuation", seededRng(seed), "easy");
      expect(allowed).toContain(prompt.answer);
    }
  });

  it("mixes prompt kinds across calls in mixed mode, including punctuation", () => {
    const rng = seededRng(42);
    const kinds = new Set<string>();
    for (let i = 0; i < 40; i++) {
      kinds.add(nextPrompt("mixed", rng).kind);
    }
    // Over 40 draws we should hit at least 3 of the 4 categories.
    expect(kinds.size).toBeGreaterThanOrEqual(3);
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

describe("recordAttempt + history cap", () => {
  function fakeAttempt(answer: string): DrillAttempt {
    return { answer, kind: "single letter", guess: answer, correct: true, at: 0 };
  }

  it("prepends newest attempts so the most recent shows first", () => {
    const after = recordAttempt(
      [fakeAttempt("a")],
      fakeAttempt("b")
    );
    expect(after.map((a) => a.answer)).toEqual(["b", "a"]);
  });

  it("caps the retained history at MAX_HISTORY", () => {
    let history: DrillAttempt[] = [];
    for (let i = 0; i < MAX_HISTORY + 20; i++) {
      history = recordAttempt(history, fakeAttempt(`a${i}`));
    }
    expect(history).toHaveLength(MAX_HISTORY);
    // The oldest entries (a0..a19) must have been dropped.
    expect(history[history.length - 1]?.answer).toBe("a20");
  });
});

describe("historyToCsv", () => {
  it("emits a header row followed by one row per attempt", () => {
    const csv = historyToCsv([
      {
        answer: "cat",
        kind: "short word",
        guess: "cat",
        correct: true,
        at: 0,
        mode: "word",
        difficulty: "easy",
        speechMode: "speech+tactile",
        responseTimeMs: 1234.4,
      },
      {
        answer: "5",
        kind: "number",
        guess: "6",
        correct: false,
        at: 1000,
        mode: "number",
        difficulty: "hard",
        speechMode: "silent",
        responseTimeMs: 2500,
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe(
      "at_iso,mode,difficulty,speech_mode,prompt_kind,expected_answer,user_answer,correct,response_time_ms"
    );
    expect(lines).toHaveLength(3);
    expect(lines[1]).toMatch(
      /^1970-01-01T00:00:00.000Z,word,easy,speech\+tactile,short word,cat,cat,1,1234$/
    );
    expect(lines[2]).toMatch(
      /^1970-01-01T00:00:01.000Z,number,hard,silent,number,5,6,0,2500$/
    );
  });

  it("RFC 4180-quotes fields that contain commas or quotes", () => {
    const csv = historyToCsv([
      { answer: 'a,b', kind: "kind", guess: 'he said "hi"', correct: false, at: 0 },
    ]);
    const line = csv.split("\n")[1]!;
    // The comma-containing field is wrapped in quotes; the quote-containing
    // field doubles its internal quotes.
    expect(line).toContain('"a,b"');
    expect(line).toContain('"he said ""hi"""');
  });

  it("produces only a header for an empty history", () => {
    expect(historyToCsv([])).toBe(
      "at_iso,mode,difficulty,speech_mode,prompt_kind,expected_answer,user_answer,correct,response_time_ms"
    );
  });

  it("keeps older persisted attempts exportable when metrics are missing", () => {
    const csv = historyToCsv([
      { answer: "a", kind: "single letter", guess: "b", correct: false, at: 0 },
    ]);
    expect(csv.split("\n")[1]).toBe(
      "1970-01-01T00:00:00.000Z,,,,single letter,a,b,0,"
    );
  });
});

describe("spokenAnswer", () => {
  it("returns the named punctuation mark for a punctuation prompt", () => {
    expect(spokenAnswer({ answer: ";", kind: "punctuation mark" })).toBe("semicolon");
    expect(spokenAnswer({ answer: "?", kind: "punctuation mark" })).toBe("question mark");
  });

  it("returns the answer unchanged for non-punctuation prompts", () => {
    expect(spokenAnswer({ answer: "cat", kind: "short word" })).toBe("cat");
  });
});

describe("perSpeechModeStats", () => {
  it("groups attempts by speech mode with accuracy and average response time", () => {
    const stats = perSpeechModeStats([
      {
        answer: "cat",
        kind: "short word",
        guess: "cat",
        correct: true,
        at: 0,
        speechMode: "speech",
        responseTimeMs: 1200,
      },
      {
        answer: "dog",
        kind: "short word",
        guess: "dog",
        correct: true,
        at: 1000,
        speechMode: "speech",
        responseTimeMs: 1800,
      },
      {
        answer: "5",
        kind: "number",
        guess: "6",
        correct: false,
        at: 2000,
        speechMode: "speech+tactile",
        responseTimeMs: 2500,
      },
    ]);
    expect(stats).toEqual([
      {
        speechMode: "speech+tactile",
        attempts: 1,
        correct: 0,
        accuracyPercent: 0,
        avgResponseTimeMs: 2500,
      },
      {
        speechMode: "speech",
        attempts: 2,
        correct: 2,
        accuracyPercent: 100,
        avgResponseTimeMs: 1500,
      },
    ]);
  });

  it("sorts by ascending accuracy so the weaker mode surfaces first", () => {
    const stats = perSpeechModeStats([
      {
        answer: "a",
        kind: "single letter",
        guess: "a",
        correct: true,
        at: 0,
        speechMode: "speech",
      },
      {
        answer: "b",
        kind: "single letter",
        guess: "b",
        correct: true,
        at: 1,
        speechMode: "speech+tactile",
      },
      {
        answer: "c",
        kind: "single letter",
        guess: "x",
        correct: false,
        at: 2,
        speechMode: "speech",
      },
    ]);
    expect(stats.map((s) => s.speechMode)).toEqual(["speech", "speech+tactile"]);
  });

  it("ignores attempts without a speech mode and returns an empty list for an empty history", () => {
    expect(perSpeechModeStats([])).toEqual([]);
    expect(
      perSpeechModeStats([
        { answer: "a", kind: "single letter", guess: "a", correct: true, at: 0 },
      ])
    ).toEqual([]);
  });

  it("leaves avgResponseTimeMs null when no attempt recorded a response time", () => {
    const stats = perSpeechModeStats([
      {
        answer: "a",
        kind: "single letter",
        guess: "a",
        correct: true,
        at: 0,
        speechMode: "speech+tactile",
      },
    ]);
    expect(stats[0]?.avgResponseTimeMs).toBeNull();
    expect(stats[0]?.accuracyPercent).toBe(100);
  });
});
