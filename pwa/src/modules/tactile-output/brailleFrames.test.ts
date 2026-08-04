import { describe, expect, it } from "vitest";
import {
  buildTactileFrames,
  parseCompactProtocol,
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

describe("parseCompactProtocol", () => {
  it("round-trips serialized frames back into the same masks and options", () => {
    const original = buildTactileFrames(translateGrade1Debug("hello"), 4);
    const serialized = serializeCompactFrames(original, { holdMs: 700, blankBetweenFrames: true });

    const parsed = parseCompactProtocol(serialized);

    expect(parsed.errors).toEqual([]);
    expect(parsed.options).toEqual({ holdMs: 700, blankBetweenFrames: true });
    expect(parsed.frames.map((f) => f.cells.map((c) => c.mask))).toEqual(
      original.map((f) => f.cells.map((c) => c.mask))
    );
    expect(parsed.frames.map((f) => f.cellStart)).toEqual(original.map((f) => f.cellStart));
  });

  it("reports the exact line number for malformed input", () => {
    const input = [
      "# header",
      "CFG hold_ms=900 blank=1",
      "F 0 0 3",
      "F 1 0 not-a-number",
      "F 2 0 300",
      "END",
    ].join("\n");

    const parsed = parseCompactProtocol(input);

    expect(parsed.errors.map((e) => e.line)).toEqual([4, 5]);
    expect(parsed.errors[0]?.message).toMatch(/Mask must be an integer/);
    expect(parsed.errors[1]?.message).toMatch(/Mask must be an integer/);
    expect(parsed.frames).toHaveLength(1);
  });

  it("flags unknown directives, missing END, and content after END", () => {
    const noEnd = parseCompactProtocol("CFG hold_ms=500 blank=0\nF 0 0 1");
    expect(noEnd.errors.some((e) => /Missing END/.test(e.message))).toBe(true);

    const unknown = parseCompactProtocol("WAT 1 2 3\nEND");
    expect(unknown.errors[0]?.message).toMatch(/Unknown directive/);

    const trailing = parseCompactProtocol("F 0 0 1\nEND\nF 1 0 2");
    expect(trailing.errors.some((e) => /after END/.test(e.message))).toBe(true);
  });

  it("validates CFG tokens", () => {
    const parsed = parseCompactProtocol(
      ["CFG hold_ms=-1 blank=2 weird=1", "F 0 0 1", "END"].join("\n")
    );
    const messages = parsed.errors.map((e) => e.message);
    expect(messages).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/hold_ms/),
        expect.stringMatching(/blank must be 0 or 1/),
        expect.stringMatching(/Unknown CFG key/),
      ])
    );
  });

  it("preserves eight-dot masks for software and HID braille paths", () => {
    const parsed = parseCompactProtocol(
      ["CFG hold_ms=500 blank=0", "F 0 0 255", "END"].join("\n")
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.frames[0]?.cells[0]?.mask).toBe(255);
    expect(parsed.frames[0]?.cells[0]?.dots).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(parsed.frames[0]?.cells[0]?.unicode).toBe(String.fromCharCode(0x28ff));
  });

  it("tolerates strip input lines and surfaces them on the parsed stream", () => {
    const parsed = parseCompactProtocol(
      [
        "CFG hold_ms=500 blank=1",
        "F 0 0 1 2 3 4",
        "IN key=next",
        "IN braille=5",
        "IN key=select",
        "END",
      ].join("\n")
    );

    expect(parsed.errors).toEqual([]);
    expect(parsed.inputs).toEqual([
      { kind: "key", value: "next" },
      { kind: "braille", value: "5" },
      { kind: "key", value: "select" },
    ]);
    // Frames still parse alongside the input lines.
    expect(parsed.frames).toHaveLength(1);
    expect(parsed.frames[0]?.cells.map((c) => c.mask)).toEqual([1, 2, 3, 4]);
  });

  it("rejects malformed strip input lines", () => {
    const parsed = parseCompactProtocol("IN key\nEND");
    expect(parsed.errors[0]?.message).toMatch(/Bad IN token/);
    expect(parsed.inputs).toEqual([]);
  });
});
