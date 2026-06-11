import { describe, expect, it } from "vitest";
import { buildRecognitionAlternatives } from "./SpeechRecognition";

describe("buildRecognitionAlternatives", () => {
  it("combines alternatives from every final segment, not just the last one", () => {
    const alternatives = buildRecognitionAlternatives(
      ["open the", "reader"],
      [
        ["open the", "open the accessible"],
        ["reader", "redder"],
      ]
    );

    expect(alternatives).toContain("open the reader");
    expect(alternatives).toContain("open the accessible reader");
    expect(alternatives).toContain("open the redder");
    expect(alternatives).toContain("open the accessible redder");
  });

  it("caps generated alternatives while preserving the top transcript", () => {
    const segments = Array.from({ length: 8 }, (_, index) => `word${index}`);
    const segmentAlternatives = segments.map((segment) =>
      Array.from({ length: 5 }, (_, index) => `${segment}-${index}`)
    );

    const alternatives = buildRecognitionAlternatives(segments, segmentAlternatives);

    expect(alternatives).toHaveLength(20);
    expect(alternatives[0]).toBe(segments.join(" "));
  });
});
