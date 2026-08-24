// Session-scoped export history for the Tactile Lab: the last 5 copy / save /
// send actions, newest first, each remembering the source text so "Replay"
// can load it back into the editor.
//
// Deliberately not persisted (unlike tactileStore): exports reference whatever
// text was in the editor, which may be private, and a stale cross-session
// replay would surprise more than it helps. Pure functions only — the page
// owns the state.

import type { OutputFormat } from "./tactileStore";

export type ExportAction = "copy" | "save" | "send";

export interface ExportHistoryEntry {
  /** Epoch ms; formatted for display via formatExportTime. */
  at: number;
  action: ExportAction;
  format: OutputFormat;
  cellCount: number;
  /** Source text at export time — replay loads it back into the editor. */
  text: string;
}

export const MAX_EXPORT_HISTORY = 5;

/** Prepend an entry, newest first, capped at MAX_EXPORT_HISTORY. */
export function recordExport(
  history: ExportHistoryEntry[],
  entry: ExportHistoryEntry
): ExportHistoryEntry[] {
  return [{ ...entry }, ...history].slice(0, MAX_EXPORT_HISTORY);
}

export function formatExportTime(at: number): string {
  return new Date(at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
