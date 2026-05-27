// Input adapters for the Tactile Lab — clipboard paste, local file read, and a
// cross-route handoff so other modules (Reader, future Touch Explorer) can ship
// text into the lab without coupling to its React state.
//
// Each helper is intentionally framework-free so it can be unit-tested without
// rendering the page.

// SessionStorage is used (not localStorage) because the handoff is meant for the
// current tab/session only — quitting the tab clears it. The key is short and
// stable so future bridges (Touch Explorer, command palette) can reuse it.
export const TACTILE_HANDOFF_KEY = "isvisible:tactile-handoff";

// Allow .txt, .md, and a few near-plain-text extensions. We reject everything
// else up front so we don't ask Liblouis to translate Word documents or PDFs —
// those would arrive as binary noise.
export const ALLOWED_FILE_EXTENSIONS = [".txt", ".md", ".markdown", ".text"];

// 100 KB. Liblouis can handle more, but the UI starts to feel sluggish past
// that and the dot-cell preview is meaningless at book length.
export const MAX_INPUT_BYTES = 100 * 1024;

// Hard upper bound on character count we expose to the translator. The byte
// cap covers UTF-8 files; this covers JS strings that came from clipboard.
export const MAX_INPUT_CHARS = 50_000;

export interface FileImportSuccess {
  ok: true;
  text: string;
  filename: string;
}

export interface FileImportError {
  ok: false;
  reason: "size" | "type" | "read";
  message: string;
}

export type FileImportResult = FileImportSuccess | FileImportError;

export function isAllowedTextFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  if (ALLOWED_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext))) return true;
  // Some text/* MIME types still come through with no extension (e.g. drag &
  // drop from a browser). Trust those too.
  return file.type.startsWith("text/");
}

export async function readTextFile(file: File): Promise<FileImportResult> {
  if (!isAllowedTextFile(file)) {
    return {
      ok: false,
      reason: "type",
      message:
        "Unsupported file type. Pick a .txt or .md file, or copy the text into the textarea instead.",
    };
  }
  if (file.size > MAX_INPUT_BYTES) {
    const limitKb = Math.round(MAX_INPUT_BYTES / 1024);
    const fileKb = Math.max(1, Math.round(file.size / 1024));
    return {
      ok: false,
      reason: "size",
      message: `File is ${fileKb} KB but the limit is ${limitKb} KB. Trim or split the file and try again.`,
    };
  }
  try {
    const text = await file.text();
    return {
      ok: true,
      text: text.slice(0, MAX_INPUT_CHARS),
      filename: file.name,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read the file.";
    return { ok: false, reason: "read", message };
  }
}

export interface HandoffPayload {
  text: string;
  source: string;
  at: number;
}

// Stash text for the Tactile Lab to pick up on its next mount. We trim to the
// same cap the file/clipboard paths use so a giant article can't blow up the
// page.
export function pushTactileHandoff(text: string, source: string): void {
  const payload: HandoffPayload = {
    text: text.slice(0, MAX_INPUT_CHARS),
    source,
    at: Date.now(),
  };
  try {
    sessionStorage.setItem(TACTILE_HANDOFF_KEY, JSON.stringify(payload));
  } catch {
    // SessionStorage can throw in private mode / quota-exceeded. The caller
    // already updates the user via speech, so silently dropping the handoff
    // is the least-surprising fallback.
  }
}

export function takeTactileHandoff(): HandoffPayload | null {
  try {
    const raw = sessionStorage.getItem(TACTILE_HANDOFF_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(TACTILE_HANDOFF_KEY);
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as HandoffPayload).text !== "string"
    ) {
      return null;
    }
    return parsed as HandoffPayload;
  } catch {
    return null;
  }
}
