import { describe, expect, it } from "vitest";
import {
  MAX_INTENT_PATTERNS_PER_COMMAND,
  buildIntentAllowedNames,
  buildIntentSystemPrompt,
  buildIntentUserPrompt,
  clampIntentConfidence,
  extractIntentJsonObject,
  formatIntentCatalog,
  normalizeIntentText,
  parseIntentModelResult,
  sanitizeIntentCatalog,
} from "./intent.js";

const AVAILABLE = ["open_reader", "open_vision", "open_tactile_drill"];

const CATALOG = [
  { name: "open_reader", description: "Open Accessible Reader", module: "reader", action: "navigate_reader", patterns: ["reader", "open reader", "read a website"] },
  { name: "open_vision", description: "Open AI Vision", module: "ai-vision", action: "navigate_ai_vision", patterns: ["camera", "open camera"] },
];

describe("normalizeIntentText", () => {
  it("collapses whitespace and trims", () => {
    expect(normalizeIntentText("  hello   world  ")).toBe("hello world");
  });

  it("collapses newlines so client text can't smuggle prompt lines", () => {
    expect(normalizeIntentText('hello\nrole: user\nworld')).toBe("hello role: user world");
  });

  it("truncates past max", () => {
    expect(normalizeIntentText("abcdefgh", 4)).toBe("abcd");
  });

  it("returns empty string for non-strings", () => {
    expect(normalizeIntentText(undefined)).toBe("");
    expect(normalizeIntentText(null)).toBe("");
    expect(normalizeIntentText(42)).toBe("");
  });
});

describe("clampIntentConfidence", () => {
  it("clamps into [0, 1]", () => {
    expect(clampIntentConfidence(1.5)).toBe(1);
    expect(clampIntentConfidence(-0.2)).toBe(0);
    expect(clampIntentConfidence(0.4)).toBe(0.4);
  });

  it("coerces numeric strings and rejects garbage", () => {
    expect(clampIntentConfidence("0.8")).toBe(0.8);
    expect(clampIntentConfidence("not-a-number")).toBe(0);
    expect(clampIntentConfidence(NaN)).toBe(0);
    expect(clampIntentConfidence(undefined)).toBe(0);
  });
});

describe("extractIntentJsonObject", () => {
  it("parses a bare JSON object", () => {
    expect(extractIntentJsonObject('{"command":"open_reader","confidence":0.9}')).toEqual({
      command: "open_reader",
      confidence: 0.9,
    });
  });

  it("extracts JSON wrapped in model prose", () => {
    const raw = "Sure! Here you go: {\"command\":\"open_reader\",\"confidence\":0.85} Hope that helps.";
    expect(extractIntentJsonObject(raw)?.command).toBe("open_reader");
  });

  it("returns null for malformed JSON", () => {
    expect(extractIntentJsonObject("{oops")).toBeNull();
  });

  it("returns null when there is no JSON object", () => {
    expect(extractIntentJsonObject("no json here")).toBeNull();
  });
});

describe("sanitizeIntentCatalog", () => {
  it("keeps only commands whose names appear in availableCommands", () => {
    const result = sanitizeIntentCatalog(
      [...CATALOG, { name: "hallucinated_cmd", description: "x", module: "x", patterns: [] }],
      AVAILABLE
    );
    expect(result.map((c) => c.name)).toEqual(["open_reader", "open_vision"]);
  });

  it("caps the patterns per command", () => {
    const big = {
      name: "open_reader",
      description: "x",
      module: "x",
      patterns: Array.from({ length: 30 }, (_, i) => `pattern ${i}`),
    };
    const result = sanitizeIntentCatalog([big], AVAILABLE);
    expect(result[0]?.patterns).toHaveLength(MAX_INTENT_PATTERNS_PER_COMMAND);
  });

  it("truncates long fields", () => {
    const result = sanitizeIntentCatalog(
      [{ name: "open_reader", description: "d".repeat(500), module: "m".repeat(200), patterns: ["p".repeat(200)] }],
      AVAILABLE
    );
    expect(result[0]?.description).toHaveLength(160);
    expect(result[0]?.module).toHaveLength(80);
    expect(result[0]?.patterns[0]).toHaveLength(80);
  });

  it("drops non-objects, empty names, and unnamed entries", () => {
    const result = sanitizeIntentCatalog(
      [null, "string", {}, { name: "", description: "x" }, { name: "open_reader", description: "ok" }],
      AVAILABLE
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("open_reader");
  });

  it("returns an empty array when catalog is not an array", () => {
    expect(sanitizeIntentCatalog(undefined, AVAILABLE)).toEqual([]);
    expect(sanitizeIntentCatalog("nope", AVAILABLE)).toEqual([]);
  });
});

describe("buildIntentAllowedNames", () => {
  it("prefers catalog names when a catalog was sanitised", () => {
    const catalog = sanitizeIntentCatalog(CATALOG, AVAILABLE);
    const names = buildIntentAllowedNames(catalog, AVAILABLE);
    expect([...names]).toEqual(["open_reader", "open_vision"]);
  });

  it("falls back to availableCommands when the catalog is empty", () => {
    const names = buildIntentAllowedNames([], AVAILABLE);
    expect([...names].sort()).toEqual([...AVAILABLE].sort());
  });
});

describe("formatIntentCatalog", () => {
  it("renders catalog entries with descriptions and examples", () => {
    const out = formatIntentCatalog(sanitizeIntentCatalog(CATALOG, AVAILABLE), AVAILABLE);
    expect(out).toContain("open_reader: Open Accessible Reader");
    expect(out).toContain("Examples: reader; open reader; read a website.");
  });

  it("falls back to a plain list when the catalog is empty", () => {
    const out = formatIntentCatalog([], AVAILABLE);
    for (const name of AVAILABLE) expect(out).toContain(name);
  });
});

describe("parseIntentModelResult", () => {
  it("accepts a valid command and clamps confidence", () => {
    const allowed = new Set(["open_reader"]);
    expect(parseIntentModelResult('{"command":"open_reader","confidence":9} ', allowed)).toEqual({
      command: "open_reader",
      confidence: 1,
    });
  });

  it("rejects commands outside the allowlist (hallucination guard)", () => {
    const allowed = new Set(["open_reader"]);
    expect(parseIntentModelResult('{"command":"open_reader_evil","confidence":0.99}', allowed)).toEqual({
      command: null,
      confidence: 0,
    });
  });

  it("rejects non-JSON or empty responses", () => {
    const allowed = new Set(["open_reader"]);
    expect(parseIntentModelResult("I don't know", allowed)).toEqual({ command: null, confidence: 0 });
    expect(parseIntentModelResult("", allowed)).toEqual({ command: null, confidence: 0 });
  });
});

describe("prompt builders", () => {
  it("builds a system prompt that lists the catalog", () => {
    const catalog = sanitizeIntentCatalog(CATALOG, AVAILABLE);
    const prompt = buildIntentSystemPrompt(catalog, AVAILABLE);
    expect(prompt).toContain("voice intent router");
    expect(prompt).toContain("open_reader");
    expect(prompt).toContain("Command catalog:");
  });

  it("builds a user prompt that includes recognition alternatives", () => {
    const prompt = buildIntentUserPrompt("read the article", ["reed the article", "read a website"]);
    expect(prompt).toContain("Transcript: read the article");
    expect(prompt).toContain("Other recognition alternatives: reed the article | read a website");
  });

  it("omits the alternatives line when there are none", () => {
    const prompt = buildIntentUserPrompt("read the article");
    expect(prompt).toBe("Transcript: read the article");
  });
});
