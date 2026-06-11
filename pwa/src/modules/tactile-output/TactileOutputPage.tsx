import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import {
  PageShell,
  toggleActive,
  toggleInactive,
  textareaClass,
} from "@/components/PageShell";
import {
  IconBraille,
  IconClipboard,
  IconRefresh,
  IconUpload,
} from "@/components/Icons";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { speechEngine } from "@/core/audio/SpeechEngine";
import {
  detectClipboardRead,
  detectWebHid,
  detectWebSerial,
} from "@/core/utils/capabilities";
import {
  buildTactileFrames,
  serializeCompactFrames,
  serializeFrames,
  translateGrade1Debug,
  type BrailleCell,
  type TactileFrame,
} from "./brailleFrames";
import {
  ALLOWED_FILE_EXTENSIONS,
  MAX_INPUT_CHARS,
  readTextFile,
  takeTactileHandoff,
} from "./inputAdapters";
import { useTactileStore } from "./tactileStore";

type SerialPortLike = {
  open: (options: { baudRate: number }) => Promise<void>;
  close: () => Promise<void>;
  writable: WritableStream<Uint8Array> | null;
};

type NavigatorWithSerial = Navigator & {
  serial?: {
    requestPort: () => Promise<SerialPortLike>;
  };
};

const DEFAULT_TEXT = "isVisible tactile output lab";
const GROUP_SIZES = [1, 4, 8] as const;
const SERIAL_BAUD_RATE = 115200;
const SERIAL_FRAME_MARGIN_MS = 25;

// Languages we expose for Grade 2 (Liblouis). The id is a subset of
// LiblouisTableId; the label is the accessible name shown in the UI.
const LANGUAGE_OPTIONS = [
  { id: "en-g2", label: "English UEB" },
  { id: "fr-g2", label: "Français" },
  { id: "de-g2", label: "Deutsch" },
] as const;

function moveLanguageSelection(
  event: ReactKeyboardEvent<HTMLElement>,
  current: string,
  select: (next: (typeof LANGUAGE_OPTIONS)[number]["id"]) => void
) {
  const forward = event.key === "ArrowRight" || event.key === "ArrowDown";
  const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
  const first = event.key === "Home";
  const last = event.key === "End";
  if (!forward && !backward && !first && !last) return;

  event.preventDefault();
  const currentIndex = Math.max(0, LANGUAGE_OPTIONS.findIndex((option) => option.id === current));
  const nextIndex = first
    ? 0
    : last
      ? LANGUAGE_OPTIONS.length - 1
      : forward
        ? (currentIndex + 1) % LANGUAGE_OPTIONS.length
        : (currentIndex - 1 + LANGUAGE_OPTIONS.length) % LANGUAGE_OPTIONS.length;
  const next = LANGUAGE_OPTIONS[nextIndex]!.id;
  select(next);
  window.setTimeout(() => {
    const target = document.querySelector<HTMLElement>(`[data-radio-value="${next}"]`);
    target?.focus();
  }, 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export default function TactileOutputPage() {
  const navigate = useNavigate();
  const announce = useAnnounce();

  // Persisted settings (zustand persist; survives reload + reinstall).
  const translatorMode = useTactileStore((s) => s.translatorMode);
  const setTranslatorMode = useTactileStore((s) => s.setTranslatorMode);
  const language = useTactileStore((s) => s.language);
  const setLanguage = useTactileStore((s) => s.setLanguage);
  const groupSize = useTactileStore((s) => s.groupSize);
  const setGroupSize = useTactileStore((s) => s.setGroupSize);
  const outputFormat = useTactileStore((s) => s.outputFormat);
  const setOutputFormat = useTactileStore((s) => s.setOutputFormat);
  const holdMs = useTactileStore((s) => s.holdMs);
  const setHoldMs = useTactileStore((s) => s.setHoldMs);
  const blankBetweenFrames = useTactileStore((s) => s.blankBetweenFrames);
  const setBlankBetweenFrames = useTactileStore((s) => s.setBlankBetweenFrames);
  const lastImportedText = useTactileStore((s) => s.lastImportedText);
  const lastImportSource = useTactileStore((s) => s.lastImportSource);
  const rememberImportedText = useTactileStore((s) => s.rememberImportedText);

  // Transient state — not worth persisting, derived on every render or only
  // meaningful within the current session.
  const [text, setText] = useState<string>(() => lastImportedText || DEFAULT_TEXT);
  const [status, setStatus] = useState("Ready");
  const [cells, setCells] = useState<BrailleCell[]>(() =>
    translateGrade1Debug(lastImportedText || DEFAULT_TEXT)
  );
  const [translatorBusy, setTranslatorBusy] = useState(false);
  const [translatorError, setTranslatorError] = useState<string | null>(null);
  // Incremented when the user clicks Retry after a Liblouis failure; the
  // translator effect watches it so the click triggers a fresh attempt
  // without us having to expose an imperative handle.
  const [retryToken, setRetryToken] = useState(0);

  // Browser-feature detection. Memoised so re-renders don't re-probe globals
  // and the consumer can compare report references cheaply.
  const serialCap = useMemo(() => detectWebSerial(), []);
  const hidCap = useMemo(() => detectWebHid(), []);
  const clipboardReadCap = useMemo(() => detectClipboardRead(), []);

  useEffect(() => {
    // Consume any text another module handed off (e.g. Reader). One-shot so
    // a stale handoff doesn't keep stomping the textarea on later mounts.
    const handoff = takeTactileHandoff();
    if (handoff && handoff.text.trim().length > 0) {
      setText(handoff.text);
      rememberImportedText(handoff.text, handoff.source);
      const label = handoff.source ? `text from ${handoff.source}` : "imported text";
      announce(`Loaded ${label}. ${handoff.text.length} characters.`);
      return;
    }
    if (lastImportedText && lastImportedText.length > 0) {
      // No fresh handoff — but the user has imported text from a previous
      // session, which is what's currently in the textarea. Tell them where
      // it came from so they're not surprised by stale content.
      const label = lastImportSource ? `from ${lastImportSource}` : "imported earlier";
      announce(`Tactile Lab. Restored last imported text ${label}.`);
      return;
    }
    announce(
      "Tactile Lab. Edit the source text, pick a translator, and stream frames to a connected device."
    );
    // Only run on mount; the deps are stable selectors / setters that
    // don't change identity, so adding them would just create noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't steal keystrokes from the source-text textarea, the hold-time
      // input, or any other form control the user is actively typing into.
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      ) {
        return;
      }
      // Plain unmodified letters only — leave OS chords alone.
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;

      switch (e.key.toLowerCase()) {
        case "c":
          e.preventDefault();
          copyFramesRef.current();
          break;
        case "s":
          e.preventDefault();
          saveFramesRef.current();
          break;
        case "n":
          e.preventDefault();
          sendSerialRef.current();
          break;
        case "v":
          e.preventDefault();
          speakPreviewRef.current();
          break;
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (translatorMode === "g1") {
      setTranslatorBusy(false);
      setTranslatorError(null);
      setCells(translateGrade1Debug(text));
      return;
    }

    let cancelled = false;
    setTranslatorBusy(true);
    setTranslatorError(null);

    // Dynamic import keeps the ~1.6 MB Liblouis WASM off the initial bundle.
    // Race against a 30s timeout so a stalled WASM download shows an error
    // instead of leaving the UI permanently in "Loading Liblouis…" state.
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Liblouis took too long to load. Check your connection and press Retry.")), 30_000)
    );
    Promise.race([
      import("./liblouisAdapter").then(({ translateWithTable }) => translateWithTable(text, language)),
      timeout,
    ])
      .then((result) => {
        if (cancelled) return;
        setCells(result);
        setTranslatorBusy(false);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Liblouis failed to translate.";
        setTranslatorError(message);
        setCells(translateGrade1Debug(text));
        setTranslatorBusy(false);
      });

    return () => {
      cancelled = true;
    };
    // retryToken is included so the Retry button can force a new attempt
    // even when text/mode/language haven't changed.
  }, [text, translatorMode, language, retryToken]);

  const frames = useMemo(() => buildTactileFrames(cells, groupSize), [cells, groupSize]);
  const frameText = useMemo(() => serializeFrames(frames), [frames]);
  const compactText = useMemo(
    () => serializeCompactFrames(frames, { holdMs, blankBetweenFrames }),
    [blankBetweenFrames, frames, holdMs]
  );
  const activeOutput = outputFormat === "json" ? frameText : compactText;
  const braillePreview = useMemo(() => cells.map((cell) => cell.unicode).join(""), [cells]);

  const updateStatus = (message: string) => {
    setStatus(message);
    announce(message);
  };

  const copyFrames = async () => {
    try {
      await navigator.clipboard.writeText(activeOutput);
      updateStatus(`${outputFormat === "json" ? "JSON" : "Compact"} output copied.`);
      speechEngine.interrupt("Output copied.");
    } catch {
      updateStatus("Copy failed. Select the JSON text manually.");
      speechEngine.interrupt("Copy failed.");
    }
  };

  const saveFrames = () => {
    const extension = outputFormat === "json" ? "jsonl" : "txt";
    const blob = new Blob([activeOutput], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `isvisible-tactile-frames.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
    updateStatus("Frame file created.");
  };

  const speakPreview = () => {
    speechEngine.interrupt(`${cells.length} cells in ${frames.length} frames. ${braillePreview}`);
  };

  // Refs are updated by every render so the keydown handler always calls
  // the latest closure without us having to re-attach the listener.
  const copyFramesRef = useRef<() => void>(() => {});
  const saveFramesRef = useRef<() => void>(() => {});
  const speakPreviewRef = useRef<() => void>(() => {});
  const sendSerialRef = useRef<() => void>(() => {});

  const sendHid = async () => {
    if (!hidCap.available) {
      updateStatus(`${hidCap.reason} ${hidCap.suggestion}`);
      speechEngine.interrupt(hidCap.reason);
      return;
    }
    // Dynamic import: the adapter file is ~3 KB but only the HID-curious
    // users ever need it, so deferring keeps it out of the initial chunk.
    const { sendBraille } = await import("./webHidAdapter");
    const result = await sendBraille(cells);
    updateStatus(result.message);
    speechEngine.interrupt(result.message);
  };

  const sendSerial = async () => {
    if (!serialCap.available) {
      updateStatus(`${serialCap.reason} ${serialCap.suggestion}`);
      speechEngine.interrupt(serialCap.reason);
      return;
    }
    const serial = (navigator as NavigatorWithSerial).serial!;

    let port: SerialPortLike | null = null;
    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

    try {
      port = await serial.requestPort();
      await port.open({ baudRate: SERIAL_BAUD_RATE });

      if (!port.writable) {
        throw new Error("Serial port is not writable.");
      }

      writer = port.writable.getWriter();
      const encoder = new TextEncoder();

      for (const line of compactText.split(/\r?\n/)) {
        await writer.write(encoder.encode(`${line}\n`));
        if (line.startsWith("F ")) {
          await sleep(holdMs + SERIAL_FRAME_MARGIN_MS);
        }
      }

      updateStatus(`Sent ${frames.length} compact frames over serial.`);
      speechEngine.interrupt(`Sent ${frames.length} frames.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Serial send failed.";
      updateStatus(message);
      speechEngine.interrupt(message);
    } finally {
      writer?.releaseLock();
      await port?.close().catch(() => undefined);
    }
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const pasteFromClipboard = async () => {
    if (!clipboardReadCap.available) {
      updateStatus(`${clipboardReadCap.reason} ${clipboardReadCap.suggestion}`);
      speechEngine.interrupt(clipboardReadCap.reason);
      return;
    }
    try {
      const pasted = await navigator.clipboard.readText();
      // Cap matches the file and handoff paths so all three sources clip at
      // the same length — drift between them would surprise users who hit
      // the limit on one path but not another.
      const trimmed = pasted.slice(0, MAX_INPUT_CHARS);
      if (trimmed.length === 0) {
        updateStatus("Clipboard is empty. Copy some text first, then try again.");
        return;
      }
      setText(trimmed);
      rememberImportedText(trimmed, "clipboard");
      updateStatus(`Pasted ${trimmed.length} characters from clipboard.`);
    } catch {
      // Permission denied or focus issues — surface a concrete next step
      // rather than the raw browser error.
      updateStatus(
        "Clipboard read was blocked. Allow clipboard access in your browser settings, or paste into the textarea by hand."
      );
      speechEngine.interrupt("Clipboard read blocked.");
    }
  };

  const onFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so picking the same file twice re-fires onChange.
    event.target.value = "";
    if (!file) return;
    const result = await readTextFile(file);
    if (!result.ok) {
      updateStatus(result.message);
      speechEngine.interrupt(result.message);
      return;
    }
    setText(result.text);
    rememberImportedText(result.text, result.filename);
    updateStatus(`Loaded ${result.filename} (${result.text.length} characters).`);
  };

  copyFramesRef.current = copyFrames;
  saveFramesRef.current = saveFrames;
  speakPreviewRef.current = speakPreview;
  sendSerialRef.current = sendSerial;

  return (
    <PageShell
      title="Tactile Lab"
      accent="rose"
      headerRight={
        <span className="text-sm text-stone-400" aria-hidden="true">{status}</span>
      }
    >
      <div className="flex-1 px-4 py-5 pb-nav-action max-w-3xl mx-auto w-full">
        <div className="lg:grid lg:grid-cols-2 lg:gap-8">
          {/* Left column: Source Text, Translator, Frame Size, Device Protocol */}
          <div className="space-y-6">
            <section aria-labelledby="input-heading">
              <div className="flex items-center justify-between mb-2">
                <h2 id="input-heading" className="text-lg font-semibold text-white">
                  Source Text
                </h2>
                <div className="flex items-center gap-1" role="group" aria-label="Source actions">
                  <Button
                    variant="ghost"
                    onClick={pasteFromClipboard}
                    disabled={!clipboardReadCap.available}
                    aria-label={
                      clipboardReadCap.available
                        ? "Paste text from clipboard"
                        : `Paste from clipboard unavailable. ${clipboardReadCap.suggestion}`
                    }
                  >
                    <IconClipboard className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Upload a text or markdown file"
                  >
                    <IconUpload className="w-5 h-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setText(DEFAULT_TEXT)}
                    aria-label="Reset text to the example phrase"
                  >
                    <IconRefresh className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              <label htmlFor="tactile-source" className="sr-only">
                Text to convert into braille tactile frames
              </label>
              <textarea
                id="tactile-source"
                value={text}
                onChange={(event) => setText(event.target.value)}
                className={`${textareaClass} min-h-36`}
                spellCheck={false}
              />
              {/* Visually hidden file picker; the Upload button triggers click().
                  accept narrows the system picker, but the adapter still validates
                  extension + MIME because mobile browsers ignore accept hints. */}
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_FILE_EXTENSIONS.join(",") + ",text/*"}
                className="sr-only"
                onChange={onFileChosen}
                aria-hidden="true"
                tabIndex={-1}
              />
            </section>

            <section aria-labelledby="translator-heading">
              <h2 id="translator-heading" className="text-lg font-semibold text-white mb-3">
                Translator
              </h2>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Braille translation mode">
                <button
                  type="button"
                  onClick={() => setTranslatorMode("g1")}
                  className={`px-3 py-2 ${
                    translatorMode === "g1" ? toggleActive : toggleInactive
                  }`}
                  aria-pressed={translatorMode === "g1"}
                >
                  Grade 1 (debug)
                </button>
                <button
                  type="button"
                  onClick={() => setTranslatorMode("g2")}
                  className={`px-3 py-2 ${
                    translatorMode === "g2" ? toggleActive : toggleInactive
                  }`}
                  aria-pressed={translatorMode === "g2"}
                  aria-describedby="translator-help"
                >
                  Grade 2 (Liblouis)
                </button>
              </div>
              <p id="translator-help" className="text-sm text-stone-300 mt-2">
                Grade 1 uses the bundled debug mapping. Grade 2 loads Liblouis on demand —
                first use downloads about 1.6 MB.
              </p>

              {translatorMode === "g2" && (
                <fieldset className="mt-3">
                  <legend className="text-sm font-semibold text-stone-200 mb-2">Language</legend>
                  <div
                    className="grid grid-cols-3 gap-2"
                    role="radiogroup"
                    aria-label="Liblouis braille language"
                  >
                    {LANGUAGE_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        role="radio"
                        aria-checked={language === option.id}
                        tabIndex={language === option.id ? 0 : -1}
                        data-radio-value={option.id}
                        onClick={() => setLanguage(option.id)}
                        onKeyDown={(event) =>
                          moveLanguageSelection(event, language, setLanguage)
                        }
                        className={`px-3 py-2 text-sm ${
                          language === option.id ? toggleActive : toggleInactive
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              )}

              {translatorBusy && (
                <p className="text-sm text-primary-300 mt-2" role="status" aria-live="polite">
                  Translating with Liblouis…
                </p>
              )}
              {translatorError && (
                <div role="alert" className="mt-2">
                  <p className="text-sm text-red-300">
                    Liblouis failed ({translatorError}). Showing Grade 1 in the meantime.
                  </p>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setTranslatorError(null);
                      setRetryToken((token) => token + 1);
                    }}
                    className="mt-2"
                    aria-label="Retry the Liblouis translation"
                  >
                    Retry Liblouis
                  </Button>
                </div>
              )}
            </section>

            <section aria-labelledby="frame-heading">
              <h2 id="frame-heading" className="text-lg font-semibold text-white mb-3">
                Frame Size
              </h2>
              <div className="grid grid-cols-3 gap-2" role="group" aria-label="Cells per frame">
                {GROUP_SIZES.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setGroupSize(size)}
                    className={`px-3 py-2 ${
                      groupSize === size ? toggleActive : toggleInactive
                    }`}
                    aria-pressed={groupSize === size}
                  >
                    {size} cell{size > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </section>

            <section aria-labelledby="device-heading">
              <h2 id="device-heading" className="text-lg font-semibold text-white mb-3">
                Device Protocol
              </h2>
              <div className="grid grid-cols-2 gap-2" role="group" aria-label="Output format">
                <button
                  type="button"
                  onClick={() => setOutputFormat("compact")}
                  className={`px-3 py-2 ${
                    outputFormat === "compact" ? toggleActive : toggleInactive
                  }`}
                  aria-pressed={outputFormat === "compact"}
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => setOutputFormat("json")}
                  className={`px-3 py-2 ${
                    outputFormat === "json" ? toggleActive : toggleInactive
                  }`}
                  aria-pressed={outputFormat === "json"}
                >
                  JSON
                </button>
              </div>

              <div className="mt-4 grid grid-cols-[1fr_auto] gap-3 items-center">
                <label htmlFor="hold-ms" className="text-stone-300">
                  Frame hold time
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="hold-ms"
                    type="number"
                    min={100}
                    max={5000}
                    step={50}
                    value={holdMs}
                    onChange={(event) => setHoldMs(Math.max(100, Math.min(5000, Number(event.target.value) || 900)))}
                    className="w-24 bg-surface-2 text-white border border-surface-border rounded-lg px-3 py-2"
                    aria-describedby="hold-ms-unit"
                  />
                  <span id="hold-ms-unit" className="text-stone-300" aria-label="milliseconds">
                    ms
                  </span>
                </div>
              </div>

              <label className="mt-3 flex items-center gap-3 min-h-touch">
                <input
                  type="checkbox"
                  checked={blankBetweenFrames}
                  onChange={(event) => setBlankBetweenFrames(event.target.checked)}
                  className="w-6 h-6"
                />
                <span className="text-stone-300">Blank pins between frames</span>
              </label>

              <div className="mt-4">
                <Button
                  variant="secondary"
                  onClick={sendHid}
                  disabled={!hidCap.available}
                  aria-label="Send to a connected HID braille display"
                  aria-describedby="hid-hint"
                  className="w-full"
                >
                  <IconBraille className="w-5 h-5 inline mr-1" /> Send to HID braille display
                </Button>
                <p id="hid-hint" className="text-xs text-stone-400 mt-2">
                  {hidCap.available
                    ? "WebHID requires Chrome/Edge over HTTPS. Pick a braille display when prompted."
                    : `${hidCap.reason} ${hidCap.suggestion}`}
                </p>
              </div>
            </section>
          </div>

          {/* Right column: Braille Preview, Dot Cells, Output */}
          <div className="space-y-6 mt-6 lg:mt-0">
            <section aria-labelledby="preview-heading">
              <div className="flex items-center justify-between mb-3">
                <h2 id="preview-heading" className="text-lg font-semibold text-white">
                  Braille Preview
                </h2>
                <Button variant="secondary" onClick={speakPreview} aria-keyshortcuts="V">
                  Speak (V)
                </Button>
              </div>

              <div
                className="bg-surface-1 border border-surface-border rounded-xl p-4"
                aria-label={`${cells.length} braille cells generated`}
              >
                <p className="text-4xl leading-relaxed break-words" lang="zxx">
                  {braillePreview || "No cells"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
                <div className="bg-surface-2 border border-surface-border rounded-lg p-3">
                  <span className="text-stone-400 block">Cells</span>
                  <span className="text-white text-xl font-bold">{cells.length}</span>
                </div>
                <div className="bg-surface-2 border border-surface-border rounded-lg p-3">
                  <span className="text-stone-400 block">Frames</span>
                  <span className="text-white text-xl font-bold">{frames.length}</span>
                </div>
              </div>
            </section>

            <section aria-labelledby="cells-heading">
              <h2 id="cells-heading" className="text-lg font-semibold text-white mb-3">
                Dot Cells
              </h2>
              <div className="grid grid-cols-4 gap-2">
                {cells.slice(0, 32).map((cell, index) => (
                  <BrailleDotCell key={`${index}-${cell.source}-${cell.role}`} cell={cell} index={index} />
                ))}
              </div>
              {cells.length > 32 && (
                <p className="text-stone-400 text-sm mt-2">{cells.length - 32} more cells in JSON output.</p>
              )}
            </section>

            <section aria-labelledby="output-heading">
              <div className="flex items-center justify-between mb-3">
                <h2 id="output-heading" className="text-lg font-semibold text-white">
                  Output
                </h2>
                <span className="text-sm text-stone-400">
                  {outputFormat === "json" ? "JSON Lines" : "Firmware text"}
                </span>
              </div>
              <textarea
                readOnly
                value={activeOutput}
                className={`${textareaClass} min-h-48 font-mono text-xs`}
                aria-label="Generated tactile frame output"
              />
              {outputFormat === "compact" && (
                <div className="mt-2">
                  <Button
                    variant="ghost"
                    onClick={() => navigate("/hardware-emulator")}
                    aria-label="Open the hardware emulator to preview this output without a device"
                  >
                    Open hardware emulator
                  </Button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <div className="fixed bottom-above-nav left-0 right-0 bg-surface-0/95 backdrop-blur border-t border-surface-border px-4 py-3">
        <div className="max-w-3xl mx-auto grid grid-cols-3 gap-2">
          <Button variant="secondary" onClick={copyFrames} aria-keyshortcuts="C">
            Copy (C)
          </Button>
          <Button variant="secondary" onClick={saveFrames} aria-keyshortcuts="S">
            <IconUpload className="w-5 h-5 inline mr-1" /> Save (S)
          </Button>
          <Button
            onClick={sendSerial}
            disabled={!serialCap.available}
            aria-keyshortcuts="N"
            aria-describedby="serial-hint"
          >
            <IconBraille className="w-5 h-5 inline mr-1" /> Send (N)
          </Button>
        </div>
        <p
          id="serial-hint"
          className="max-w-3xl mx-auto text-center text-xs text-stone-400 mt-2"
        >
          {serialCap.available
            ? "Keyboard: C copy, S save, N send, V speak preview. F6 anywhere for voice."
            : `${serialCap.reason} ${serialCap.suggestion}`}
        </p>
      </div>
    </PageShell>
  );
}

function BrailleDotCell({
  cell,
  index,
}: {
  cell: TactileFrame["cells"][number];
  index: number;
}) {
  return (
    <div
      className="bg-surface-2 border border-surface-border rounded-lg p-2"
      aria-label={`Cell ${index + 1}, source ${cell.source || "blank"}, dots ${
        cell.dots.length ? cell.dots.join(", ") : "none"
      }`}
    >
      <div className="grid grid-cols-2 gap-1 w-10 mx-auto">
        {[1, 4, 2, 5, 3, 6].map((dot) => (
          <span
            key={dot}
            className={`w-4 h-4 rounded-full border ${
              cell.dots.includes(dot)
                ? "bg-primary-300 border-primary-200"
                : "bg-surface-3 border-surface-border"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
      <p className="text-center text-xs text-stone-400 mt-2 truncate">
        {cell.source === " " ? "space" : cell.source}
      </p>
    </div>
  );
}
