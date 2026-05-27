import { describe, expect, it } from "vitest";
import {
  DISCLOSURES,
  SCOPE_CLASSES,
  SCOPE_LABELS,
  type Scope,
} from "./disclosures";

const VALID_SCOPES: Scope[] = ["local", "system", "server", "third-party"];

describe("privacy disclosures", () => {
  it("has a unique id per disclosure", () => {
    const ids = DISCLOSURES.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every data path we ship with at least one entry", () => {
    const ids = DISCLOSURES.map((d) => d.id);
    // Each id corresponds to a real surface in the app — if any of these is
    // missing, the in-app privacy claim is incomplete and reviewers will
    // catch it before users do.
    for (const expected of [
      "clipboard",
      "files-and-text",
      "persisted-state",
      "speech-output",
      "voice-input",
      "ai-vision",
      "reader-fetch",
      "hardware-bridges",
    ]) {
      expect(ids).toContain(expected);
    }
  });

  it("uses a known scope for every disclosure", () => {
    for (const d of DISCLOSURES) {
      expect(VALID_SCOPES).toContain(d.scope);
    }
  });

  it("provides a label and a CSS chip class for every scope", () => {
    for (const scope of VALID_SCOPES) {
      expect(SCOPE_LABELS[scope]).toBeTruthy();
      expect(SCOPE_CLASSES[scope]).toBeTruthy();
    }
  });

  it("keeps summary and detail strings non-empty and distinct", () => {
    for (const d of DISCLOSURES) {
      expect(d.summary.trim().length).toBeGreaterThan(0);
      expect(d.detail.trim().length).toBeGreaterThan(0);
      // Detail should add something beyond the one-liner.
      expect(d.detail).not.toBe(d.summary);
    }
  });
});
