import { describe, expect, it } from "vitest";

import {
  formatExportTime,
  MAX_EXPORT_HISTORY,
  recordExport,
  type ExportHistoryEntry,
} from "./exportHistory";

function entry(at: number): ExportHistoryEntry {
  return { at, action: "save", format: "compact", cellCount: at, text: `text ${at}` };
}

describe("recordExport", () => {
  it("prepends the newest entry", () => {
    const history = recordExport([entry(1)], entry(2));
    expect(history[0]?.at).toBe(2);
    expect(history[1]?.at).toBe(1);
  });

  it("caps the list at MAX_EXPORT_HISTORY entries", () => {
    let history: ExportHistoryEntry[] = [];
    for (let i = 0; i < MAX_EXPORT_HISTORY + 3; i++) {
      history = recordExport(history, entry(i));
    }
    expect(history).toHaveLength(MAX_EXPORT_HISTORY);
    expect(history[0]?.at).toBe(MAX_EXPORT_HISTORY + 2);
    expect(history[MAX_EXPORT_HISTORY - 1]?.at).toBe(3);
  });

  it("does not mutate the previous array", () => {
    const before = [entry(1)];
    const after = recordExport(before, entry(2));
    expect(before).toHaveLength(1);
    expect(after).toHaveLength(2);
  });
});

describe("formatExportTime", () => {
  it("formats an epoch timestamp as a locale time string", () => {
    const formatted = formatExportTime(new Date("2026-01-01T12:34:56").getTime());
    expect(formatted.length).toBeGreaterThan(0);
    expect(formatted).toMatch(/12[:.]34/);
  });
});
