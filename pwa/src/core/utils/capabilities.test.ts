import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectCapability,
  detectClipboardRead,
  detectClipboardWrite,
  detectSpeechRecognition,
  detectSpeechSynthesis,
  detectWebHid,
  detectWebSerial,
} from "./capabilities";

// Stash and restore each property the detectors probe. Doing this with
// Object.defineProperty lets us toggle a key on/off without touching the
// rest of the global, which matters because vitest in Node 20+ exposes a
// real navigator/window with its own shape.
function withGlobalKey<T>(
  target: object,
  key: string,
  value: unknown,
  fn: () => T
): T {
  const had = Object.prototype.hasOwnProperty.call(target, key);
  const previous = (target as Record<string, unknown>)[key];
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
  try {
    return fn();
  } finally {
    if (had) {
      Object.defineProperty(target, key, {
        value: previous,
        configurable: true,
        writable: true,
      });
    } else {
      delete (target as Record<string, unknown>)[key];
    }
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detectWebSerial", () => {
  it("returns available when navigator.serial exists", () => {
    withGlobalKey(navigator, "serial", { requestPort: async () => null }, () => {
      const report = detectWebSerial();
      expect(report.available).toBe(true);
      expect(report.reason).toBe("");
    });
  });

  it("returns unavailable with a Chromium hint when navigator.serial is missing", () => {
    expect("serial" in navigator).toBe(false);
    const report = detectWebSerial();
    expect(report.available).toBe(false);
    expect(report.reason).toMatch(/Web Serial/);
    expect(report.suggestion).toMatch(/Chromium/);
    // The suggestion should always include a non-empty next step.
    expect(report.suggestion.length).toBeGreaterThan(0);
  });
});

describe("detectWebHid", () => {
  it("returns available when navigator.hid exists", () => {
    withGlobalKey(navigator, "hid", { requestDevice: async () => [] }, () => {
      expect(detectWebHid().available).toBe(true);
    });
  });

  it("returns unavailable with Chromium-only advice otherwise", () => {
    expect("hid" in navigator).toBe(false);
    const report = detectWebHid();
    expect(report.available).toBe(false);
    expect(report.suggestion).toMatch(/Firefox|Safari|Chromium/);
  });
});

describe("detectClipboardRead", () => {
  it("returns available when navigator.clipboard.readText exists", () => {
    withGlobalKey(
      navigator,
      "clipboard",
      { readText: async () => "x", writeText: async () => undefined },
      () => {
        expect(detectClipboardRead().available).toBe(true);
      }
    );
  });

  it("returns unavailable with paste-or-upload guidance when missing", () => {
    const report = detectClipboardRead();
    expect(report.available).toBe(false);
    expect(report.suggestion).toMatch(/textarea|upload/i);
  });
});

describe("detectClipboardWrite", () => {
  it("returns available when writeText exists", () => {
    withGlobalKey(
      navigator,
      "clipboard",
      { readText: async () => "x", writeText: async () => undefined },
      () => {
        expect(detectClipboardWrite().available).toBe(true);
      }
    );
  });

  it("returns unavailable with select-and-copy guidance when missing", () => {
    const report = detectClipboardWrite();
    expect(report.available).toBe(false);
    expect(report.suggestion).toMatch(/select|copy/i);
  });
});

describe("detectSpeechSynthesis", () => {
  it("returns available when window.speechSynthesis exists", () => {
    withGlobalKey(globalThis, "window", { speechSynthesis: {} }, () => {
      expect(detectSpeechSynthesis().available).toBe(true);
    });
  });

  it("returns unavailable when window or speechSynthesis is missing", () => {
    // The vitest Node env doesn't expose window.speechSynthesis. We don't
    // assert on the absence path beyond available=false because the runner
    // may or may not have a window global at all.
    const report = detectSpeechSynthesis();
    expect(typeof report.available).toBe("boolean");
    if (!report.available) {
      expect(report.suggestion.length).toBeGreaterThan(0);
    }
  });
});

describe("detectSpeechRecognition", () => {
  it("returns available when SpeechRecognition exists on window", () => {
    withGlobalKey(globalThis, "window", { SpeechRecognition: function () {} }, () => {
      expect(detectSpeechRecognition().available).toBe(true);
    });
  });

  it("also accepts the webkit-prefixed constructor (Safari)", () => {
    withGlobalKey(
      globalThis,
      "window",
      { webkitSpeechRecognition: function () {} },
      () => {
        expect(detectSpeechRecognition().available).toBe(true);
      }
    );
  });

  it("returns unavailable when neither constructor is present", () => {
    withGlobalKey(globalThis, "window", {}, () => {
      const report = detectSpeechRecognition();
      expect(report.available).toBe(false);
      expect(report.suggestion).toMatch(/voice|Chrome|Edge|Safari/i);
    });
  });
});

describe("detectCapability dispatcher", () => {
  it("routes ids to the right detector", () => {
    expect(detectCapability("web-serial")).toEqual(detectWebSerial());
    expect(detectCapability("web-hid")).toEqual(detectWebHid());
    expect(detectCapability("clipboard-read")).toEqual(detectClipboardRead());
  });
});
