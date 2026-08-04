import { describe, it, expect } from "vitest";
import {
  DEFAULT_CELL_COLS,
  DEFAULT_CELL_ROWS,
  buildGraphicsFrames,
  describeRegions,
  detectRegions,
  isRaised,
  luminancePixelsToMatrix,
  matrixToAscii,
  pinDensity,
  pinMatrixToCellMasks,
} from "./graphicsConverter";

// Build a solid-color RGBA buffer (all pixels the same luminance).
function solidPixelBuffer(width: number, height: number, luminance: number): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(width * height * 4);
  const v = Math.round(luminance);
  for (let i = 0; i < buf.length; i += 4) {
    buf[i] = v;
    buf[i + 1] = v;
    buf[i + 2] = v;
    buf[i + 3] = 255;
  }
  return buf;
}

// Paint a filled rectangle into an RGBA buffer (dark = raised ink).
function paintRect(
  buf: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  w: number,
  h: number,
  luminance: number
) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const idx = (yy * width + xx) * 4;
      buf[idx] = luminance;
      buf[idx + 1] = luminance;
      buf[idx + 2] = luminance;
    }
  }
}

function matrix(cols: number, rows: number, raised: number[]): ReturnType<typeof luminancePixelsToMatrix> {
  const pins = new Uint8Array(cols * rows);
  for (const idx of raised) pins[idx] = 1;
  return { cols, rows, pins };
}

describe("luminancePixelsToMatrix", () => {
  it("raises pins where the block is darker than the threshold", () => {
    // 2x2 pin grid sampled from 4x4 source: top-left quarter black, rest white.
    const src = solidPixelBuffer(4, 4, 255);
    paintRect(src, 4, 0, 0, 2, 2, 0);

    const m = luminancePixelsToMatrix(src, 4, 4, 2, 2, 128);
    expect(matrixToAscii(m)).toBe("#.\n..");
  });

  it("raises a pin when any ink exists in a partially filled block", () => {
    // 1x1 pin from a 4x4 source with a single dark pixel.
    const src = solidPixelBuffer(4, 4, 255);
    paintRect(src, 4, 0, 0, 1, 1, 0);
    const m = luminancePixelsToMatrix(src, 4, 4, 1, 1, 128);
    expect(m.pins[0]).toBe(1);
  });

  it("leaves a bright block lowered", () => {
    const m = luminancePixelsToMatrix(solidPixelBuffer(2, 2, 255), 2, 2, 1, 1, 128);
    expect(m.pins[0]).toBe(0);
  });

  it("rejects a source buffer smaller than the declared size", () => {
    expect(() => luminancePixelsToMatrix(new Uint8ClampedArray(4), 4, 4, 2, 2)).toThrow();
  });
});

describe("pinMatrixToCellMasks", () => {
  it("packs a 4x4 pin grid (2x1 cells) into two cells", () => {
    // cell0 = dots 1+4 (pins 0,0 and 1,1), cell1 = dot 6 (pin 3,2).
    const m = matrix(4, 4, [0, 5, 11]);
    const rows = pinMatrixToCellMasks(m, 2);
    expect(rows).toEqual([[1 | 8, 1 << 5]]);
  });

  it("maps dot 7/8 to the bottom row of each cell", () => {
    // Only cell: bottom-row pins (3,0) and (3,1) → dots 7+8.
    const m = matrix(2, 4, [6, 7]);
    const rows = pinMatrixToCellMasks(m, 1);
    expect(rows).toEqual([[(1 << 6) | (1 << 7)]]);
  });

  it("rejects a matrix whose height is not a multiple of four", () => {
    expect(() => pinMatrixToCellMasks(matrix(2, 5, []), 1)).toThrow();
  });
});

describe("buildGraphicsFrames", () => {
  it("emits one frame per cell-row with correct cellStart", () => {
    const frames = buildGraphicsFrames([[1, 2], [3, 4]], 2);
    expect(frames).toHaveLength(2);
    expect(frames[0]?.mode).toBe("graphics");
    expect(frames[0]?.cellStart).toBe(0);
    expect(frames[1]?.cellStart).toBe(2);
    expect(frames[0]?.cells.map((c) => c.mask)).toEqual([1, 2]);
  });
});

describe("detectRegions", () => {
  it("labels disconnected clusters with distinct letters", () => {
    // Two raised pins diagonally separated → two single-pin regions.
    const m = matrix(3, 3, [0, 8]);
    const regions = detectRegions(m);
    expect(regions.map((r) => r.label)).toEqual(["A", "B"]);
    expect(regions.map((r) => r.pinCount)).toEqual([1, 1]);
  });

  it("merges orthogonally adjacent pins into one region", () => {
    const m = matrix(3, 3, [0, 1, 3]); // L-shape, all 4-connected
    const regions = detectRegions(m);
    expect(regions).toHaveLength(1);
    expect(regions[0]?.pinCount).toBe(3);
    expect(regions[0]?.bounds).toEqual({ col: 0, row: 0, width: 2, height: 2 });
  });

  it("returns an empty list for a blank grid", () => {
    expect(detectRegions(matrix(4, 4, []))).toEqual([]);
  });

  it("describes regions with compass positions", () => {
    // 3x3 block in the top-left of a 6x6 grid (rows 0-2, cols 0-2).
    const m = matrix(6, 6, [0, 1, 2, 6, 7, 8, 12, 13, 14]);
    const text = describeRegions(detectRegions(m));
    expect(text).toMatch(/Region A, 9 raised pins, top left/);
  });
});

describe("matrix helpers", () => {
  it("isRaised reads row-major pins", () => {
    const m = matrix(2, 2, [1]);
    expect(isRaised(m, 1, 0)).toBe(true);
    expect(isRaised(m, 0, 0)).toBe(false);
  });

  it("pinDensity is the fraction of raised pins", () => {
    expect(pinDensity(matrix(4, 4, [0, 1, 2, 3]))).toBe(0.25);
  });

  it("exposes the default grid size in cells", () => {
    // 8 cells wide x 4 cells tall → a 16x16 pin grid.
    expect(DEFAULT_CELL_COLS).toBe(8);
    expect(DEFAULT_CELL_ROWS).toBe(4);
  });
});
