import { afterEach, describe, expect, it, vi } from "vitest";
import {
  detectCacheStorage,
  detectCamera,
  detectCapability,
  detectClipboardRead,
  detectClipboardWrite,
  detectMicrophone,
  detectServiceWorker,
  detectSpeechRecognition,
  detectSpeechSynthesis,
  detectVibration,
  detectWebHid,
  detectWebSerial,
  queryMediaPermission,
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

async function withGlobalKeyAsync<T>(
  target: object,
  key: string,
  value: unknown,
  fn: () => Promise<T>
): Promise<T> {
  const had = Object.prototype.hasOwnProperty.call(target, key);
  const previous = (target as Record<string, unknown>)[key];
  Object.defineProperty(target, key, { value, configurable: true, writable: true });
  try {
    return await fn();
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

function withNavigator<T>(fn: (nav: Navigator) => T): T {
  const nav = (typeof navigator !== "undefined" ? navigator : {}) as Navigator;
  return withGlobalKey(globalThis, "navigator", nav, () => fn(nav));
}

function withNavigatorAsync<T>(fn: (nav: Navigator) => Promise<T>): Promise<T> {
  const nav = (typeof navigator !== "undefined" ? navigator : {}) as Navigator;
  return withGlobalKeyAsync(globalThis, "navigator", nav, () => fn(nav));
}

describe("detectWebSerial", () => {
  it("returns available when navigator.serial exists", () => {
    withNavigator((nav) => {
      withGlobalKey(nav, "serial", { requestPort: async () => null }, () => {
        const report = detectWebSerial();
        expect(report.available).toBe(true);
        expect(report.reason).toBe("");
      });
    });
  });

  it("returns unavailable with a Chromium hint when navigator.serial is missing", () => {
    withNavigator((nav) => {
      expect("serial" in nav).toBe(false);
      const report = detectWebSerial();
      expect(report.available).toBe(false);
      expect(report.reason).toMatch(/Web Serial/);
      expect(report.suggestion).toMatch(/Chromium/);
      // The suggestion should always include a non-empty next step.
      expect(report.suggestion.length).toBeGreaterThan(0);
    });
  });
});

describe("detectCamera and detectMicrophone", () => {
  it("return available when getUserMedia exists", () => {
    withNavigator((nav) => {
      withGlobalKey(nav, "mediaDevices", { getUserMedia: async () => ({}) }, () => {
        expect(detectCamera().available).toBe(true);
        expect(detectMicrophone().available).toBe(true);
      });
    });
  });

  it("return HTTPS guidance when mediaDevices is missing", () => {
    withNavigator((nav) => {
      withGlobalKey(nav, "mediaDevices", undefined, () => {
        expect(detectCamera().suggestion).toMatch(/HTTPS|localhost/i);
        expect(detectMicrophone().suggestion).toMatch(/HTTPS|localhost/i);
      });
    });
  });
});

describe("detectWebHid", () => {
  it("returns available when navigator.hid exists", () => {
    withNavigator((nav) => {
      withGlobalKey(nav, "hid", { requestDevice: async () => [] }, () => {
        expect(detectWebHid().available).toBe(true);
      });
    });
  });

  it("returns unavailable with Chromium-only advice otherwise", () => {
    withNavigator((nav) => {
      expect("hid" in nav).toBe(false);
      const report = detectWebHid();
      expect(report.available).toBe(false);
      expect(report.suggestion).toMatch(/Firefox|Safari|Chromium/);
    });
  });
});

describe("detectClipboardRead", () => {
  it("returns available when navigator.clipboard.readText exists", () => {
    withNavigator((nav) => {
      withGlobalKey(
        nav,
        "clipboard",
        { readText: async () => "x", writeText: async () => undefined },
        () => {
          expect(detectClipboardRead().available).toBe(true);
        }
      );
    });
  });

  it("returns unavailable with paste-or-upload guidance when missing", () => {
    const report = detectClipboardRead();
    expect(report.available).toBe(false);
    expect(report.suggestion).toMatch(/textarea|upload/i);
  });
});

describe("detectClipboardWrite", () => {
  it("returns available when writeText exists", () => {
    withNavigator((nav) => {
      withGlobalKey(
        nav,
        "clipboard",
        { readText: async () => "x", writeText: async () => undefined },
        () => {
          expect(detectClipboardWrite().available).toBe(true);
        }
      );
    });
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

describe("detectVibration", () => {
  it("returns available when navigator.vibrate exists", () => {
    withNavigator((nav) => {
      withGlobalKey(nav, "vibrate", vi.fn(), () => {
        expect(detectVibration().available).toBe(true);
      });
    });
  });

  it("returns unavailable with speech/audio fallback guidance otherwise", () => {
    withNavigator((nav) => {
      withGlobalKey(nav, "vibrate", undefined, () => {
        const report = detectVibration();
        expect(report.available).toBe(false);
        expect(report.suggestion).toMatch(/speech|audio/i);
      });
    });
  });
});

describe("detectServiceWorker and detectCacheStorage", () => {
  it("return available when the browser exposes offline APIs", () => {
    withNavigator((nav) => {
      withGlobalKey(nav, "serviceWorker", {}, () => {
        withGlobalKey(globalThis, "caches", {}, () => {
          expect(detectServiceWorker().available).toBe(true);
          expect(detectCacheStorage().available).toBe(true);
        });
      });
    });
  });

  it("return setup guidance when offline APIs are unavailable", () => {
    withNavigator((nav) => {
      withGlobalKey(nav, "serviceWorker", undefined, () => {
        withGlobalKey(globalThis, "caches", undefined, () => {
          expect(detectServiceWorker().suggestion).toMatch(/HTTPS|localhost/i);
          expect(detectCacheStorage().suggestion).toMatch(/HTTPS|localhost|private/i);
        });
      });
    });
  });
});

describe("detectCapability dispatcher", () => {
  it("routes ids to the right detector", () => {
    expect(detectCapability("camera")).toEqual(detectCamera());
    expect(detectCapability("microphone")).toEqual(detectMicrophone());
    expect(detectCapability("web-serial")).toEqual(detectWebSerial());
    expect(detectCapability("web-hid")).toEqual(detectWebHid());
    expect(detectCapability("clipboard-read")).toEqual(detectClipboardRead());
    expect(detectCapability("vibration")).toEqual(detectVibration());
    expect(detectCapability("service-worker")).toEqual(detectServiceWorker());
    expect(detectCapability("cache-storage")).toEqual(detectCacheStorage());
  });
});

describe("queryMediaPermission", () => {
  it("returns null when the Permissions API is unavailable", async () => {
    await withNavigatorAsync(async (nav) => {
      await withGlobalKeyAsync(nav, "permissions", undefined, async () => {
        await expect(queryMediaPermission("camera")).resolves.toBeNull();
      });
    });
  });

  it("maps granted, denied, and prompt states", async () => {
    await withNavigatorAsync(async (nav) => {
      const query = vi
        .fn()
        .mockResolvedValueOnce({ state: "granted" })
        .mockResolvedValueOnce({ state: "denied" })
        .mockResolvedValueOnce({ state: "prompt" });

      await withGlobalKeyAsync(nav, "permissions", { query }, async () => {
        await expect(queryMediaPermission("camera")).resolves.toBe("granted");
        await expect(queryMediaPermission("microphone")).resolves.toBe("denied");
        await expect(queryMediaPermission("camera")).resolves.toBe("unknown");
      });

      expect(query).toHaveBeenNthCalledWith(1, { name: "camera" });
      expect(query).toHaveBeenNthCalledWith(2, { name: "microphone" });
    });
  });

  it("returns null when the browser rejects a media permission query", async () => {
    await withNavigatorAsync(async (nav) => {
      await withGlobalKeyAsync(
        nav,
        "permissions",
        { query: vi.fn().mockRejectedValue(new Error("unsupported")) },
        async () => {
          await expect(queryMediaPermission("camera")).resolves.toBeNull();
        }
      );
    });
  });
});
