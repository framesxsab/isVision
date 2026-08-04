/**
 * Tactile Graphics — converts an image into a low-resolution pin matrix that a
 * braille-cell display can render, and segments the raised pins into labeled
 * regions.
 *
 * A graphics pin matrix is a grid of raised/lowered pins. A braille display
 * renders it in units of cells, where each cell is 2 columns × 4 rows of pins
 * (the standard 8-dot layout: dots 1-2 top, 3-4 second, 5-6 third, 7-8
 * bottom). So a `CELL_COLS × CELL_ROWS` display gives a pin grid of
 * `(CELL_COLS*2) × (CELL_ROWS*4)`.
 *
 * The frame output reuses the compact protocol from the Tactile Lab, so a
 * graphic plays on the same serial/HID hardware as braille text.
 */

import { createCell, type TactileFrame } from "../tactile-output/brailleFrames";

export interface PinMatrix {
  /** Number of pin columns. */
  cols: number;
  /** Number of pin rows. */
  rows: number;
  /** cols*rows entries, 1 = raised pin, 0 = lowered. Row-major. */
  pins: Uint8Array;
}

export interface GraphicsRegion {
  /** Sequential letter label: A, B, C… */
  label: string;
  /** Number of raised pins in the region. */
  pinCount: number;
  /** Bounding box in pin coordinates. */
  bounds: { col: number; row: number; width: number; height: number };
  /** Center of the bounding box, in 0..1 relative to the grid. */
  center: { x: number; y: number };
}

/** Defaults for the graphics grid, expressed in braille cells. */
export const DEFAULT_CELL_COLS = 8;
export const DEFAULT_CELL_ROWS = 4;

/** Luminance below this is treated as "ink" → a raised pin. */
export const DEFAULT_THRESHOLD = 128;

/**
 * Downsample raw RGBA pixel data into a pin matrix.
 *
 * Each pin is raised when its source block contains any pixel darker than the
 * threshold (dark ink → tactile relief). Block *minimum* luminance is used
 * rather than the average because thin 1px lines must survive downsampling to
 * a 16-pin grid — averaging a hairline across a large block would lose it.
 */
export function luminancePixelsToMatrix(
  pixels: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  pinCols: number,
  pinRows: number,
  threshold = DEFAULT_THRESHOLD
): PinMatrix {
  if (pixels.length < srcWidth * srcHeight * 4) {
    throw new Error("Pixel buffer is smaller than the declared source size.");
  }
  if (!Number.isInteger(pinCols) || !Number.isInteger(pinRows) || pinCols < 1 || pinRows < 1) {
    throw new Error("pinCols and pinRows must be positive integers.");
  }

  const pins = new Uint8Array(pinCols * pinRows);

  const blockRange = (start: number, end: number) => {
    const s = Math.max(0, Math.floor(start));
    const e = Math.min(srcHeight, Math.ceil(end));
    return [s, e] as const;
  };

  for (let r = 0; r < pinRows; r++) {
    const [y0, y1] = blockRange((r * srcHeight) / pinRows, ((r + 1) * srcHeight) / pinRows);
    for (let c = 0; c < pinCols; c++) {
      const [x0, x1] = blockRange((c * srcWidth) / pinCols, ((c + 1) * srcWidth) / pinCols);

      let min = 255;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const idx = (y * srcWidth + x) * 4;
          const luminance = 0.299 * pixels[idx]! + 0.587 * pixels[idx + 1]! + 0.114 * pixels[idx + 2]!;
          if (luminance < min) min = luminance;
        }
      }
      pins[r * pinCols + c] = min < threshold ? 1 : 0;
    }
  }

  return { cols: pinCols, rows: pinRows, pins };
}

/** True when the pin at (col, row) is raised. */
export function isRaised(matrix: PinMatrix, col: number, row: number): boolean {
  return matrix.pins[row * matrix.cols + col] === 1;
}

/** ASCII rendering ('#' raised, '.' lowered) for tests and sighted previews. */
export function matrixToAscii(matrix: PinMatrix): string {
  const lines: string[] = [];
  for (let r = 0; r < matrix.rows; r++) {
    let line = "";
    for (let c = 0; c < matrix.cols; c++) {
      line += isRaised(matrix, c, r) ? "#" : ".";
    }
    lines.push(line);
  }
  return lines.join("\n");
}

/**
 * Pack a pin matrix into braille-cell masks.
 *
 * The matrix must have an even number of columns and a multiple-of-4 number of
 * rows (each braille cell is 2 wide × 4 tall). Returns one row of masks per
 * cell-row; each row has `cellsPerRow` masks in scan order.
 */
export function pinMatrixToCellMasks(
  matrix: PinMatrix,
  cellsPerRow = DEFAULT_CELL_COLS
): number[][] {
  if (matrix.cols % 2 !== 0 || matrix.rows % 4 !== 0) {
    throw new Error(
      `Pin matrix must be cellsPerRow*2 by cellRows*4 (got ${matrix.cols}x${matrix.rows}).`
    );
  }
  if (matrix.cols / 2 !== cellsPerRow) {
    throw new Error(
      `cellsPerRow ${cellsPerRow} does not match a ${matrix.cols}-pin-wide matrix.`
    );
  }

  const cellRows = matrix.rows / 4;
  const rows: number[][] = [];

  for (let cellRow = 0; cellRow < cellRows; cellRow++) {
    const masks: number[] = [];
    for (let cellCol = 0; cellCol < cellsPerRow; cellCol++) {
      const pinX = cellCol * 2;
      const pinY = cellRow * 4;
      let mask = 0;
      const pin = (dx: number, dy: number) => isRaised(matrix, pinX + dx, pinY + dy);
      if (pin(0, 0)) mask |= 1 << 0;
      if (pin(1, 0)) mask |= 1 << 1;
      if (pin(0, 1)) mask |= 1 << 2;
      if (pin(1, 1)) mask |= 1 << 3;
      if (pin(0, 2)) mask |= 1 << 4;
      if (pin(1, 2)) mask |= 1 << 5;
      if (pin(0, 3)) mask |= 1 << 6;
      if (pin(1, 3)) mask |= 1 << 7;
      masks.push(mask);
    }
    rows.push(masks);
  }

  return rows;
}

/**
 * Build TactileLab-compatible frames from cell-mask rows: each cell-row becomes
 * one frame, so a multi-row graphic plays top row first then bottom rows.
 */
export function buildGraphicsFrames(
  maskRows: number[][],
  cellsPerRow = DEFAULT_CELL_COLS
): TactileFrame[] {
  return maskRows.map((masks, rowIndex) => ({
    type: "frame",
    mode: "graphics",
    index: rowIndex,
    cellStart: rowIndex * cellsPerRow,
    cells: masks.map((mask) => createCell(mask, "", "content")),
  }));
}

/**
 * Segment raised pins into connected regions (4-connectivity), scan order.
 * Uses iterative BFS so large grids never overflow the stack.
 */
export function detectRegions(matrix: PinMatrix): GraphicsRegion[] {
  const visited = new Uint8Array(matrix.cols * matrix.rows);
  const regions: GraphicsRegion[] = [];

  const raise = (idx: number) => {
    visited[idx] = 1;
  };

  const neighborIndices = (idx: number): number[] => {
    const col = idx % matrix.cols;
    const row = Math.floor(idx / matrix.cols);
    const out: number[] = [];
    if (col > 0) out.push(idx - 1);
    if (col < matrix.cols - 1) out.push(idx + 1);
    if (row > 0) out.push(idx - matrix.cols);
    if (row < matrix.rows - 1) out.push(idx + matrix.cols);
    return out;
  };

  for (let idx = 0; idx < matrix.pins.length; idx++) {
    if (matrix.pins[idx] === 0 || visited[idx] === 1) continue;

    const component: number[] = [];
    const queue = [idx];
    raise(idx);

    while (queue.length > 0) {
      const cur = queue.pop()!;
      component.push(cur);
      for (const next of neighborIndices(cur)) {
        if (matrix.pins[next] === 1 && visited[next] === 0) {
          raise(next);
          queue.push(next);
        }
      }
    }

    let minCol = matrix.cols;
    let minRow = matrix.rows;
    let maxCol = -1;
    let maxRow = -1;
    for (const p of component) {
      const col = p % matrix.cols;
      const row = Math.floor(p / matrix.cols);
      if (col < minCol) minCol = col;
      if (col > maxCol) maxCol = col;
      if (row < minRow) minRow = row;
      if (row > maxRow) maxRow = row;
    }

    const width = maxCol - minCol + 1;
    const height = maxRow - minRow + 1;
    regions.push({
      label: String.fromCharCode(65 + regions.length),
      pinCount: component.length,
      bounds: { col: minCol, row: minRow, width, height },
      center: {
        x: (minCol + width / 2) / matrix.cols,
        y: (minRow + height / 2) / matrix.rows,
      },
    });
  }

  return regions;
}

/** Map a 0..1 relative position to a spoken compass position. */
function compassPosition(x: number, y: number): string {
  const xPart = x < 1 / 3 ? "left" : x > 2 / 3 ? "right" : "center";
  const yPart = y < 1 / 3 ? "top" : y > 2 / 3 ? "bottom" : "middle";
  return `${yPart} ${xPart}`.trim();
}

/** Human-readable spoken summary of the segmented regions. */
export function describeRegions(regions: GraphicsRegion[]): string {
  if (regions.length === 0) return "No raised regions found in this image.";
  const parts = regions.map(
    (region) =>
      `Region ${region.label}, ${region.pinCount} raised pins, ${compassPosition(
        region.center.x,
        region.center.y
      )}`
  );
  return `${regions.length} region${regions.length === 1 ? "" : "s"}: ${parts.join(". ")}.`;
}

/** Fraction of pins raised — a "ink density" sanity check for the user. */
export function pinDensity(matrix: PinMatrix): number {
  let raised = 0;
  for (const pin of matrix.pins) {
    if (pin === 1) raised++;
  }
  return raised / (matrix.cols * matrix.rows);
}
