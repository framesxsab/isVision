import { describe, expect, it } from "vitest";
import {
  matchCommand,
  matchCommandWithAlternatives,
  normalizeTranscript,
} from "./commandRegistry";

describe("normalizeTranscript", () => {
  it("strips punctuation and lowercases", () => {
    expect(normalizeTranscript("Open Camera, please!")).toBe("open camera");
  });

  it("removes filler words", () => {
    expect(normalizeTranscript("could you please open the camera now")).toBe(
      "open camera"
    );
  });

  it("collapses whitespace", () => {
    expect(normalizeTranscript("go   home")).toBe("go home");
  });

  it("returns empty string when only fillers", () => {
    expect(normalizeTranscript("please could you")).toBe("");
  });
});

describe("matchCommand", () => {
  it("matches an exact command pattern with confidence 1.0", () => {
    const result = matchCommand("help");
    expect(result?.command.name).toBe("help");
    expect(result?.confidence).toBe(1.0);
  });

  it("strips filler words before matching", () => {
    const result = matchCommand("please open the camera");
    expect(result?.command.name).toBe("open_vision");
  });

  it("matches with word boundaries — 'back' does not match inside 'background'", () => {
    // "background noise" should NOT trigger the back/go_back command.
    const result = matchCommand("background noise from outside");
    expect(result).toBeNull();
  });

  it("prefers the longest matching pattern (go home beats home)", () => {
    // "go home" and "home" both exist; the longer pattern should win.
    const result = matchCommand("go home now");
    expect(result?.command.name).toBe("go_home");
  });

  it("prefers 'previous paragraph' over 'previous' when both could match", () => {
    const result = matchCommand("previous paragraph");
    expect(result?.command.name).toBe("previous");
    expect(result?.confidence).toBeGreaterThanOrEqual(0.95);
  });

  it("rejects short fuzzy matches that are below the strict threshold", () => {
    // "soup" is a single-edit away from "stop" but should not trigger stop.
    expect(matchCommand("soup")).toBeNull();
  });

  it("accepts close fuzzy matches on longer patterns", () => {
    // 'tactile drll' (typo for 'tactile drill') should still match.
    const result = matchCommand("tactile drll");
    expect(result?.command.name).toBe("open_tactile_drill");
  });

  it("returns null for empty input", () => {
    expect(matchCommand("")).toBeNull();
    expect(matchCommand("please the")).toBeNull();
  });
});

describe("matchCommandWithAlternatives", () => {
  it("picks the alternative that matches when the top guess does not", () => {
    // Browser's top guess is gibberish; alt #2 is a valid command.
    const result = matchCommandWithAlternatives([
      "stoplight ahead",
      "open camera",
    ]);
    expect(result?.command.name).toBe("open_vision");
    expect(result?.matchedAlternative).toBe("open camera");
  });

  it("returns null when no alternative matches", () => {
    const result = matchCommandWithAlternatives([
      "the weather is nice",
      "tell me a story",
    ]);
    expect(result).toBeNull();
  });

  it("short-circuits on an exact-match alternative", () => {
    const result = matchCommandWithAlternatives(["help"]);
    expect(result?.confidence).toBe(1.0);
  });

  it("picks the highest-confidence match across alternatives", () => {
    // First alt is a fuzzy match, second is exact — the exact should win.
    const result = matchCommandWithAlternatives([
      "tactile drll",
      "tactile drill",
    ]);
    expect(result?.matchedAlternative).toBe("tactile drill");
    expect(result?.confidence).toBeGreaterThanOrEqual(0.95);
  });
});
