import { describe, expect, it } from "vitest";
import {
  buildTactileFrames,
  serializeCompactFrames,
  serializeFrames,
  translateGrade1Debug,
} from "./brailleFrames";

describe("tactile braille frame generation", () => {
  it("maps letters, capitals, and numbers to debug braille cells", () => {
    const cells = translateGrade1Debug("A1z");

    expect(cells.map((cell) => cell.mask)).toEqual([32, 1, 60, 1, 53]);
    expect(cells.map((cell) => cell.role)).toEqual([
      "capital-sign",
      "content",
      "number-sign",
      "content",
      "content",
    ]);
  });

  it("groups cells into fixed-size frames", () => {
    const frames = buildTactileFrames(translateGrade1Debug("abc"), 2);

    expect(frames).toHaveLength(2);
    expect(frames[0]?.cellStart).toBe(0);
    expect(frames[0]?.cells.map((cell) => cell.mask)).toEqual([1, 3]);
    expect(frames[1]?.cellStart).toBe(2);
    expect(frames[1]?.cells.map((cell) => cell.mask)).toEqual([9]);
  });

  it("serializes debug JSON lines and compact firmware lines", () => {
    const frames = buildTactileFrames(translateGrade1Debug("ab"), 1);

    expect(serializeFrames(frames).split("\n")).toHaveLength(2);
    expect(serializeCompactFrames(frames, { holdMs: 500, blankBetweenFrames: false })).toBe(
      [
        "# isVisible tactile compact protocol v1",
        "CFG hold_ms=500 blank=0",
        "F 0 0 1",
        "F 1 1 3",
        "END",
      ].join("\n")
    );
  });
});
