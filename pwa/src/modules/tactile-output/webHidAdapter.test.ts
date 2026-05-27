import { describe, expect, it, vi } from "vitest";
import { translateGrade1Debug } from "./brailleFrames";
import {
  BRAILLE_USAGE,
  BRAILLE_USAGE_PAGE,
  MAX_HID_CELLS,
  cellsToReport,
  isWebHidSupported,
  sendBraille,
  type BrailleHidDevice,
} from "./webHidAdapter";

describe("cellsToReport", () => {
  it("flattens braille cells into a Uint8Array of dot masks", () => {
    const cells = translateGrade1Debug("ab");
    const report = cellsToReport(cells);
    expect(report).toBeInstanceOf(Uint8Array);
    // 'a' = mask 1, 'b' = mask 3 in the debug mapping.
    expect(Array.from(report)).toEqual([1, 3]);
  });

  it("truncates oversize cell arrays to MAX_HID_CELLS", () => {
    const oversize = Array.from({ length: MAX_HID_CELLS + 5 }, () => ({
      mask: 0xff,
      source: "x",
      role: "content" as const,
      dots: [],
      unicode: "",
    }));
    const report = cellsToReport(oversize);
    expect(report.length).toBe(MAX_HID_CELLS);
  });

  it("returns an empty buffer for no cells", () => {
    expect(cellsToReport([]).length).toBe(0);
  });
});

describe("isWebHidSupported", () => {
  it("returns false when navigator.hid is missing (default in jsdom)", () => {
    // The vitest jsdom env doesn't expose WebHID; this lets the calling page
    // disable the Send-via-HID button without crashing.
    expect(isWebHidSupported()).toBe(false);
  });
});

describe("sendBraille", () => {
  it("rejects gracefully when no HID api and no injected device exist", async () => {
    const result = await sendBraille(translateGrade1Debug("a"), { hid: null });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/not supported/i);
  });

  it("opens the device and writes a report when a device is injected", async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    const sendReport = vi.fn().mockResolvedValue(undefined);
    const fake: BrailleHidDevice = {
      productName: "Fake Display 14",
      opened: false,
      open,
      sendReport,
    };

    const result = await sendBraille(translateGrade1Debug("ab"), { device: fake, reportId: 0 });

    expect(result.ok).toBe(true);
    expect(result.cellsSent).toBe(2);
    expect(open).toHaveBeenCalledTimes(1);
    expect(sendReport).toHaveBeenCalledTimes(1);
    const [reportId, data] = sendReport.mock.calls[0]!;
    expect(reportId).toBe(0);
    expect(data).toBeInstanceOf(Uint8Array);
    expect(Array.from(data as Uint8Array)).toEqual([1, 3]);
  });

  it("skips open() when the device is already open", async () => {
    const open = vi.fn();
    const sendReport = vi.fn().mockResolvedValue(undefined);
    const fake: BrailleHidDevice = {
      opened: true,
      open,
      sendReport,
    };

    await sendBraille(translateGrade1Debug("a"), { device: fake });

    expect(open).not.toHaveBeenCalled();
    expect(sendReport).toHaveBeenCalledOnce();
  });

  it("requests a HID device with the braille usage filter when none is injected", async () => {
    const sendReport = vi.fn().mockResolvedValue(undefined);
    const device: BrailleHidDevice = { opened: true, open: vi.fn(), sendReport };
    const requestDevice = vi.fn().mockResolvedValue([device]);

    await sendBraille(translateGrade1Debug("x"), { hid: { requestDevice } });

    expect(requestDevice).toHaveBeenCalledWith({
      filters: [{ usagePage: BRAILLE_USAGE_PAGE, usage: BRAILLE_USAGE }],
    });
  });

  it("returns a friendly error when the user cancels device selection", async () => {
    const requestDevice = vi.fn().mockResolvedValue([]);
    const result = await sendBraille(translateGrade1Debug("x"), { hid: { requestDevice } });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/no braille display/i);
  });

  it("returns a SendBrailleResult instead of throwing when requestDevice rejects", async () => {
    // SecurityError, NotAllowedError, missing user gesture, permissions
    // policy block — they all surface as a rejected promise from
    // requestDevice. The page click handler doesn't catch, so a leak here
    // would become an uncaught promise rejection at runtime.
    const requestDevice = vi
      .fn()
      .mockRejectedValue(new DOMException("Must be handling a user gesture", "SecurityError"));
    const result = await sendBraille(translateGrade1Debug("x"), { hid: { requestDevice } });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/user gesture/i);
    expect(result.cellsSent).toBe(0);
  });

  it("returns a SendBrailleResult instead of throwing when device.open() rejects", async () => {
    const device: BrailleHidDevice = {
      opened: false,
      open: vi.fn().mockRejectedValue(new Error("device busy")),
      sendReport: vi.fn(),
    };
    const result = await sendBraille(translateGrade1Debug("x"), { device });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/device busy/);
  });

  it("surfaces a write failure without throwing", async () => {
    const device: BrailleHidDevice = {
      opened: true,
      open: vi.fn(),
      sendReport: vi.fn().mockRejectedValue(new Error("kernel32 hates you")),
    };
    const result = await sendBraille(translateGrade1Debug("x"), { device });
    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/kernel32/);
  });
});
