// WebHID adapter for braille displays.
//
// The HID spec defines a "Braille Display" usage page (0x41) and a top-level
// "Braille Display" usage (0x01); compliant devices accept an output report
// whose payload is a flat Uint8Array of cell masks (one byte per cell, dots 1–8
// in low → high bit order). We don't know any specific VID/PID up front, so we
// pass the usage filter to requestDevice() and let the user pick.
//
// This is a scaffold: there's no real braille display in our CI, so the unit
// test exercises the encoder (cellsToReport) plus the dispatcher (sendBraille
// with an injectable HID handle). End-to-end verification happens manually with
// a real display.

import type { BrailleCell } from "./brailleFrames";

// Standard HID Braille Display usage.
export const BRAILLE_USAGE_PAGE = 0x41;
export const BRAILLE_USAGE = 0x01;

// Default output-report ID. 0 means "no report ID" in the HID spec — the device
// firmware decides. Most generic displays accept 0.
export const DEFAULT_OUTPUT_REPORT_ID = 0;

// Hard cap so a runaway translator can't ship a 50 KB report. 256 cells is well
// past the biggest commercial braille display (Active Star 80 = 80 cells).
export const MAX_HID_CELLS = 256;

export interface BrailleHidDevice {
  productName?: string;
  opened: boolean;
  open(): Promise<void>;
  // Real navigator.hid.sendReport accepts BufferSource, but the TS 5.8 generic
  // on Uint8Array<TArrayBuffer> doesn't narrow to ArrayBuffer cleanly. We only
  // ever ship Uint8Array or raw ArrayBuffer, so we type the parameter to match
  // what we send and avoid the ceremony of a cast at the call site.
  sendReport(reportId: number, data: Uint8Array | ArrayBuffer): Promise<void>;
  close?(): Promise<void>;
}

interface NavigatorHidLike {
  requestDevice(options: {
    filters: Array<{ usagePage?: number; usage?: number }>;
  }): Promise<BrailleHidDevice[]>;
}

export function getHidApi(): NavigatorHidLike | null {
  const nav = navigator as Navigator & { hid?: NavigatorHidLike };
  return nav.hid ?? null;
}

export function isWebHidSupported(): boolean {
  return getHidApi() !== null;
}

// Convert a flat list of cells into the byte buffer a braille display expects.
// Each cell's mask already holds dots 1-8 in the same bit order the HID braille
// usage page uses, so the conversion is a straight `& 0xff` truncation.
export function cellsToReport(cells: BrailleCell[]): Uint8Array {
  const trimmed = cells.slice(0, MAX_HID_CELLS);
  const buf = new Uint8Array(trimmed.length);
  for (let i = 0; i < trimmed.length; i++) {
    buf[i] = trimmed[i]!.mask & 0xff;
  }
  return buf;
}

export interface SendBrailleResult {
  ok: boolean;
  message: string;
  productName?: string;
  cellsSent: number;
}

// Request a device (or reuse one), open it if needed, and send a single output
// report containing the cell masks. Exposed device argument lets tests inject
// a stub instead of going through navigator.hid.
export async function sendBraille(
  cells: BrailleCell[],
  opts: {
    reportId?: number;
    device?: BrailleHidDevice;
    hid?: NavigatorHidLike | null;
  } = {}
): Promise<SendBrailleResult> {
  const hid = opts.hid ?? getHidApi();
  if (!opts.device && !hid) {
    return { ok: false, message: "WebHID is not supported in this browser.", cellsSent: 0 };
  }

  // The whole HID dance (chooser → open → write) goes in one try so any
  // rejection — SecurityError from a missing user gesture, NotAllowedError
  // from a permissions-policy block, the user cancelling the chooser, an
  // open() failing because the OS already claimed the device, or the write
  // itself failing — comes back as a SendBrailleResult instead of an
  // unhandled promise rejection in the click handler.
  let device = opts.device ?? null;
  try {
    if (!device) {
      const granted = await hid!.requestDevice({
        filters: [{ usagePage: BRAILLE_USAGE_PAGE, usage: BRAILLE_USAGE }],
      });
      device = granted[0] ?? null;
      if (!device) {
        return { ok: false, message: "No braille display was selected.", cellsSent: 0 };
      }
    }
    if (!device.opened) await device.open();
    const report = cellsToReport(cells);
    await device.sendReport(opts.reportId ?? DEFAULT_OUTPUT_REPORT_ID, report);
    return {
      ok: true,
      message: `Sent ${report.length} cells to ${device.productName ?? "HID braille display"}.`,
      productName: device.productName,
      cellsSent: report.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "HID send failed.";
    return { ok: false, message, cellsSent: 0 };
  }
}
