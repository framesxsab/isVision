export interface BrailleCell {
  mask: number;
  source: string;
  role: "content" | "capital-sign" | "number-sign" | "punctuation" | "space" | "unknown";
  dots: number[];
  unicode: string;
}

export interface TactileFrame {
  type: "frame";
  mode: "text";
  index: number;
  cellStart: number;
  cells: BrailleCell[];
}

export interface CompactProtocolOptions {
  holdMs: number;
  blankBetweenFrames: boolean;
}

const DOTS_BY_LETTER: Record<string, number> = {
  a: 0b000001,
  b: 0b000011,
  c: 0b001001,
  d: 0b011001,
  e: 0b010001,
  f: 0b001011,
  g: 0b011011,
  h: 0b010011,
  i: 0b001010,
  j: 0b011010,
  k: 0b000101,
  l: 0b000111,
  m: 0b001101,
  n: 0b011101,
  o: 0b010101,
  p: 0b001111,
  q: 0b011111,
  r: 0b010111,
  s: 0b001110,
  t: 0b011110,
  u: 0b100101,
  v: 0b100111,
  w: 0b111010,
  x: 0b101101,
  y: 0b111101,
  z: 0b110101,
};

const PUNCTUATION_DOTS: Record<string, number> = {
  ",": 0b000010,
  ";": 0b000110,
  ":": 0b010010,
  ".": 0b110010,
  "!": 0b010110,
  "?": 0b100110,
  "-": 0b100100,
  "'": 0b000100,
  " ": 0,
};

const CAPITAL_SIGN = 0b100000;
const NUMBER_SIGN = 0b111100;

export function createCell(mask: number, source: string, role: BrailleCell["role"] = "content"): BrailleCell {
  return {
    mask,
    source,
    role,
    dots: [1, 2, 3, 4, 5, 6].filter((dot) => (mask & (1 << (dot - 1))) !== 0),
    unicode: String.fromCharCode(0x2800 + mask),
  };
}

export function translateGrade1Debug(text: string): BrailleCell[] {
  const cells: BrailleCell[] = [];

  for (const char of text) {
    const lower = char.toLowerCase();

    if (/[a-z]/i.test(char) && DOTS_BY_LETTER[lower] !== undefined) {
      if (char === char.toUpperCase() && char !== char.toLowerCase()) {
        cells.push(createCell(CAPITAL_SIGN, char, "capital-sign"));
      }
      cells.push(createCell(DOTS_BY_LETTER[lower], char));
      continue;
    }

    if (/^\d$/.test(char)) {
      cells.push(createCell(NUMBER_SIGN, char, "number-sign"));
      const digitLetter = char === "0" ? "j" : String.fromCharCode("a".charCodeAt(0) + Number(char) - 1);
      cells.push(createCell(DOTS_BY_LETTER[digitLetter] ?? 0, char));
      continue;
    }

    if (PUNCTUATION_DOTS[char] !== undefined) {
      cells.push(createCell(PUNCTUATION_DOTS[char], char, char === " " ? "space" : "punctuation"));
      continue;
    }

    cells.push(createCell(0, char, "unknown"));
  }

  return cells;
}

export function buildTactileFrames(cells: BrailleCell[], groupSize: number): TactileFrame[] {
  if (!Number.isInteger(groupSize) || groupSize < 1) {
    throw new Error("groupSize must be a positive integer.");
  }

  const frames: TactileFrame[] = [];

  for (let start = 0; start < cells.length; start += groupSize) {
    frames.push({
      type: "frame",
      mode: "text",
      index: frames.length,
      cellStart: start,
      cells: cells.slice(start, start + groupSize),
    });
  }

  return frames;
}

export function serializeFrames(frames: TactileFrame[]): string {
  return frames.map((frame) => JSON.stringify(frame)).join("\n");
}

export function serializeCompactFrames(
  frames: TactileFrame[],
  options: CompactProtocolOptions = { holdMs: 900, blankBetweenFrames: true }
): string {
  const lines = [
    "# isVisible tactile compact protocol v1",
    `CFG hold_ms=${options.holdMs} blank=${options.blankBetweenFrames ? 1 : 0}`,
  ];

  for (const frame of frames) {
    const masks = frame.cells.map((cell) => cell.mask).join(" ");
    lines.push(`F ${frame.index} ${frame.cellStart} ${masks}`.trim());
    if (options.blankBetweenFrames) {
      lines.push("B");
    }
  }

  lines.push("END");
  return lines.join("\n");
}

export function getFrameMasks(frame: TactileFrame): number[] {
  return frame.cells.map((cell) => cell.mask);
}
