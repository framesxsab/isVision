import { describe, expect, it } from "vitest";
import { brailleStringToCells } from "./liblouisAdapter";

describe("brailleStringToCells", () => {
  it("decodes U+2800-block characters into the BrailleCell shape", () => {
    // ⠓⠑⠇⠇⠕ is the UEB Grade 1 form of "hello" and a stable fixture across
    // Liblouis releases. Decoding it back to dot masks proves the round-trip
    // (Unicode → mask → dot positions) the rest of the pipeline relies on.
    const cells = brailleStringToCells("⠓⠑⠇⠇⠕");

    expect(cells.map((c) => c.mask)).toEqual([
      0b010011, // h
      0b010001, // e
      0b000111, // l
      0b000111, // l
      0b010101, // o
    ]);
    expect(cells.map((c) => c.unicode)).toEqual(["⠓", "⠑", "⠇", "⠇", "⠕"]);
    expect(cells.every((c) => c.role === "content")).toBe(true);
  });

  it("labels ASCII spaces as space cells with an empty dot mask", () => {
    const cells = brailleStringToCells(" ");
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ mask: 0, source: " ", role: "space", dots: [] });
  });

  it("flags non-braille characters as unknown rather than crashing", () => {
    const cells = brailleStringToCells("x");
    expect(cells[0]).toMatchObject({ mask: 0, source: "x", role: "unknown" });
  });

  it("preserves dot ordering for cells with multiple dots set", () => {
    // U+28FF = mask 0b11111111 = all eight dots. Software/HID paths must
    // keep dots 7 and 8 even when a six-dot serial device later ignores them.
    const cells = brailleStringToCells(String.fromCharCode(0x28ff));
    expect(cells[0]?.mask).toBe(255);
    expect(cells[0]?.dots).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("returns an empty array for empty input", () => {
    expect(brailleStringToCells("")).toEqual([]);
  });
});
