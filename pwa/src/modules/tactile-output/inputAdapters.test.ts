import { describe, expect, it, beforeEach, beforeAll } from "vitest";
import {
  TACTILE_HANDOFF_KEY,
  MAX_INPUT_BYTES,
  MAX_INPUT_CHARS,
  isAllowedTextFile,
  pushTactileHandoff,
  readTextFile,
  takeTactileHandoff,
} from "./inputAdapters";

// Vitest uses the Node environment by default. Node 20 ships navigator but not
// sessionStorage, so we install a minimal Map-backed shim that matches the
// browser API surface the adapters touch (getItem / setItem / removeItem /
// clear). Keeping the shim local to this test file avoids dragging jsdom into
// the rest of the suite, which already runs fine in Node.
beforeAll(() => {
  if (typeof globalThis.sessionStorage === "undefined") {
    const store = new Map<string, string>();
    const shim: Storage = {
      get length() {
        return store.size;
      },
      clear: () => store.clear(),
      getItem: (k) => store.get(k) ?? null,
      key: (i) => Array.from(store.keys())[i] ?? null,
      removeItem: (k) => {
        store.delete(k);
      },
      setItem: (k, v) => {
        store.set(k, String(v));
      },
    };
    Object.defineProperty(globalThis, "sessionStorage", {
      value: shim,
      configurable: true,
    });
  }
});

function makeFile(name: string, body: string, type = "text/plain"): File {
  return new File([body], name, { type });
}

describe("isAllowedTextFile", () => {
  it("accepts plain text and markdown extensions", () => {
    expect(isAllowedTextFile(makeFile("notes.txt", "x"))).toBe(true);
    expect(isAllowedTextFile(makeFile("README.md", "x"))).toBe(true);
    expect(isAllowedTextFile(makeFile("doc.markdown", "x"))).toBe(true);
  });

  it("accepts files with any text/* MIME even without a known extension", () => {
    expect(isAllowedTextFile(new File(["x"], "snippet", { type: "text/plain" }))).toBe(true);
  });

  it("rejects binary-looking files", () => {
    expect(isAllowedTextFile(makeFile("image.png", "x", "image/png"))).toBe(false);
    expect(isAllowedTextFile(new File(["x"], "doc.pdf", { type: "application/pdf" }))).toBe(false);
  });
});

describe("readTextFile", () => {
  it("returns the file contents for a small text file", async () => {
    const result = await readTextFile(makeFile("a.txt", "hello"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.text).toBe("hello");
      expect(result.filename).toBe("a.txt");
    }
  });

  it("rejects oversized files before reading them", async () => {
    // Build the oversized file from a small payload via Blob trickery — we
    // can't allocate ~100 KB in a unit test cheaply but we can lie about size.
    const tiny = new File(["x"], "big.txt", { type: "text/plain" });
    Object.defineProperty(tiny, "size", { value: MAX_INPUT_BYTES + 1 });
    const result = await readTextFile(tiny);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("size");
  });

  it("rejects unsupported file types", async () => {
    const result = await readTextFile(new File(["x"], "image.png", { type: "image/png" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("type");
  });

  it("truncates extremely long contents at the character cap", async () => {
    const long = "a".repeat(MAX_INPUT_CHARS + 100);
    const result = await readTextFile(makeFile("long.txt", long));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.text.length).toBe(MAX_INPUT_CHARS);
  });
});

describe("tactile handoff via sessionStorage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("round-trips text and source through sessionStorage", () => {
    pushTactileHandoff("hello from reader", "reader");
    const payload = takeTactileHandoff();
    expect(payload).not.toBeNull();
    expect(payload?.text).toBe("hello from reader");
    expect(payload?.source).toBe("reader");
    expect(typeof payload?.at).toBe("number");
  });

  it("clears the slot after being consumed (one-shot)", () => {
    pushTactileHandoff("once", "reader");
    expect(takeTactileHandoff()?.text).toBe("once");
    expect(takeTactileHandoff()).toBeNull();
  });

  it("returns null on empty or malformed payloads", () => {
    expect(takeTactileHandoff()).toBeNull();
    sessionStorage.setItem(TACTILE_HANDOFF_KEY, "{not json");
    expect(takeTactileHandoff()).toBeNull();
    sessionStorage.setItem(TACTILE_HANDOFF_KEY, JSON.stringify({ foo: 1 }));
    expect(takeTactileHandoff()).toBeNull();
  });

  it("caps handed-off text at the same character limit as file imports", () => {
    pushTactileHandoff("a".repeat(MAX_INPUT_CHARS + 50), "reader");
    expect(takeTactileHandoff()?.text.length).toBe(MAX_INPUT_CHARS);
  });
});
