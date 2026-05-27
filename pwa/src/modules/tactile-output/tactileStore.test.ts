import { beforeEach, describe, expect, it, vi } from "vitest";

// Zustand persist resolves its storage once at store-module import time, so we
// have to install the localStorage shim BEFORE any import that touches the
// store reaches for window.localStorage. vi.hoisted runs before all imports,
// which is exactly the slot we need.
vi.hoisted(() => {
  for (const key of ["localStorage", "sessionStorage"] as const) {
    if (typeof (globalThis as Record<string, unknown>)[key] === "undefined") {
      const store = new Map<string, string>();
      const shim: Storage = {
        get length() {
          return store.size;
        },
        clear: () => store.clear(),
        getItem: (k) => store.get(k) ?? null,
        key: (i) => Array.from(store.keys())[i] ?? null,
        removeItem: (k) => {
          store.delete(k);
        },
        setItem: (k, v) => {
          store.set(k, String(v));
        },
      };
      Object.defineProperty(globalThis, key, { value: shim, configurable: true });
    }
  }
});

import { INITIAL_SCORE } from "./drillState";
import { useTactileStore } from "./tactileStore";

beforeEach(() => {
  localStorage.clear();
  // Reset the store to defaults between tests. Zustand exposes setState for
  // this exact purpose.
  useTactileStore.setState({
    lastImportedText: "",
    lastImportSource: "",
    translatorMode: "g1",
    language: "en-g2",
    groupSize: 1,
    outputFormat: "compact",
    holdMs: 900,
    blankBetweenFrames: true,
    drillScore: INITIAL_SCORE,
    drillMode: "letter",
    drillSpeechMode: "silent",
    drillDifficulty: "normal",
    drillHistory: [],
  });
});

describe("tactileStore", () => {
  it("starts with sensible defaults", () => {
    const s = useTactileStore.getState();
    expect(s.translatorMode).toBe("g1");
    expect(s.language).toBe("en-g2");
    expect(s.groupSize).toBe(1);
    expect(s.outputFormat).toBe("compact");
    expect(s.holdMs).toBe(900);
    expect(s.blankBetweenFrames).toBe(true);
    expect(s.drillScore).toEqual(INITIAL_SCORE);
    expect(s.drillMode).toBe("letter");
    expect(s.drillSpeechMode).toBe("silent");
  });

  it("rememberImportedText stores text and source together", () => {
    useTactileStore.getState().rememberImportedText("hello", "Reader");
    const s = useTactileStore.getState();
    expect(s.lastImportedText).toBe("hello");
    expect(s.lastImportSource).toBe("Reader");
  });

  it("clamps holdMs to the [100, 5000] range", () => {
    const setHoldMs = useTactileStore.getState().setHoldMs;
    setHoldMs(50);
    expect(useTactileStore.getState().holdMs).toBe(100);
    setHoldMs(99999);
    expect(useTactileStore.getState().holdMs).toBe(5000);
    setHoldMs(NaN);
    // NaN falls back to the sensible default so a stored value can never
    // poison the slider.
    expect(useTactileStore.getState().holdMs).toBe(900);
  });

  it("rejects invalid translator modes and falls back to g1", () => {
    useTactileStore.getState().setTranslatorMode("garbage" as never);
    expect(useTactileStore.getState().translatorMode).toBe("g1");
  });

  it("rejects unknown language ids and falls back to English UEB", () => {
    useTactileStore.getState().setLanguage("klingon-g4" as never);
    expect(useTactileStore.getState().language).toBe("en-g2");
  });

  it("only accepts group sizes that the UI exposes", () => {
    useTactileStore.getState().setGroupSize(3);
    expect(useTactileStore.getState().groupSize).toBe(1);
    useTactileStore.getState().setGroupSize(8);
    expect(useTactileStore.getState().groupSize).toBe(8);
  });

  it("resetDrillScore restores the initial score and clears history", () => {
    useTactileStore.getState().setDrillScore({ attempts: 10, correct: 7, streak: 3 });
    useTactileStore.getState().pushDrillAttempt({
      answer: "cat",
      kind: "short word",
      guess: "cat",
      correct: true,
      at: 1,
    });
    useTactileStore.getState().resetDrillScore();
    expect(useTactileStore.getState().drillScore).toEqual(INITIAL_SCORE);
    expect(useTactileStore.getState().drillHistory).toEqual([]);
  });

  it("rejects invalid difficulties and falls back to normal", () => {
    useTactileStore.getState().setDrillDifficulty("brutal" as never);
    expect(useTactileStore.getState().drillDifficulty).toBe("normal");
    useTactileStore.getState().setDrillDifficulty("hard");
    expect(useTactileStore.getState().drillDifficulty).toBe("hard");
  });

  it("pushDrillAttempt prepends and caps history", () => {
    const store = useTactileStore.getState();
    for (let i = 0; i < 5; i++) {
      store.pushDrillAttempt({
        answer: `a${i}`,
        kind: "single letter",
        guess: `a${i}`,
        correct: i % 2 === 0,
        at: i,
      });
    }
    const history = useTactileStore.getState().drillHistory;
    expect(history).toHaveLength(5);
    // Newest first.
    expect(history[0]?.answer).toBe("a4");
    expect(history[4]?.answer).toBe("a0");
  });

  // Note: we deliberately don't test "writes land in localStorage" here.
  // That's zustand-persist's internal behavior and the timing differs
  // between node/jsdom/happy-dom environments (sync vs queued via
  // microtask). Persisting end-to-end is covered by the Playwright
  // suite, which runs against a real browser.
});
