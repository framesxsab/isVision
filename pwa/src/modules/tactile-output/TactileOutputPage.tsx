import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import {
  IconArrowLeft,
  IconBraille,
  IconClipboard,
  IconRefresh,
  IconUpload,
} from "@/components/Icons";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { speechEngine } from "@/core/audio/SpeechEngine";
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

// Languages we expose for Grade 2 (Liblouis). The id is a subset of
// LiblouisTableId; the label is the accessible name shown in the UI.
const LANGUAGE_OPTIONS = [
  { id: "en-g2", label: "English UEB" },
  { id: "fr-g2", label: "Français" },
  { id: "de-g2", label: "Deutsch" },
] as const;

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
    import("./liblouisAdapter")
      .then(({ translateWithTable }) => translateWithTable(text, language))
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
  }, [text, translatorMode, language]);

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
    // Dynamic import: the adapter file is ~3 KB but only the HID-curious
    // users ever need it, so deferring keeps it out of the initial chunk.
    const { sendBraille, isWebHidSupported } = await import("./webHidAdapter");
    if (!isWebHidSupported()) {
      updateStatus("WebHID is not supported in this browser.");
      speechEngine.interrupt("WebHID not supported.");
      return;
    }
    const result = await sendBraille(cells);
    updateStatus(result.message);
    speechEngine.interrupt(result.message);
  };

  const sendSerial = async () => {
    const serial = (navigator as NavigatorWithSerial).serial;
    if (!serial) {
      updateStatus("Web Serial is not supported in this browser.");
      speechEngine.interrupt("Web Serial is not supported in this browser.");
      return;
    }

    let port: SerialPortLike | null = null;
    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

    try {
      port = await serial.requestPort();
      await port.open({ baudRate: 115200 });

      if (!port.writable) {
        throw new Error("Serial port is not writable.");
      }

      writer = port.writable.getWriter();
      const encoder = new TextEncoder();

      await writer.write(encoder.encode(`${compactText}\n`));

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
    if (!navigator.clipboard?.readText) {
      updateStatus("Clipboard read is not supported in this browser.");
      speechEngine.interrupt("Clipboard not supported.");
      return;
    }
    try {
      const pasted = await navigator.clipboard.readText();
      // Cap matches the file and handoff paths so all three sources clip at
      // the same length — drift between them would surprise users who hit
      // the limit on one path but not another.
      const trimmed = pasted.slice(0, MAX_INPUT_CHARS);
      if (trimmed.length === 0) {
        updateStatus("Clipboard is empty.");
        return;
      }
      setText(trimmed);
      rememberImportedText(trimmed, "clipboard");
      updateStatus(`Pasted ${trimmed.length} characters from clipboard.`);
    } catch {
      // Permission denied or focus issues — both are non-fatal.
      updateStatus("Could not read clipboard. Check browser permissions.");
      speechEngine.interrupt("Clipboard read failed.");
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
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button variant="ghost" onClick={() => navigate("/")} aria-label="Go back to home">
            <IconArrowLeft className="w-5 h-5 inline mr-1" /> Back
          </Button>
          <h1 className="text-lg font-bold text-white">Tactile Lab</h1>
          {/* Visual-only mirror of the status. The AriaLiveProvider already owns
              the polite live region — duplicating it here would double-announce. */}
          <span className="text-sm text-gray-400 w-20 text-right" aria-hidden="true">
            {status}
          </span>
        </div>
      </header>

      <div className="flex-1 px-4 py-5 pb-28 max-w-lg mx-auto w-full space-y-6">
        <section aria-labelledby="input-heading">
          <div className="flex items-center justify-between mb-2">
            <h2 id="input-heading" className="text-lg font-semibold text-white">
              Source Text
            </h2>
            <div className="flex items-center gap-1" role="group" aria-label="Source actions">
              <Button
                variant="ghost"
                onClick={pasteFromClipboard}
                aria-label="Paste text from clipboard"
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
            className="w-full min-h-36 bg-gray-900 text-white border border-gray-700 rounded-xl px-4 py-3 leading-relaxed"
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
              className={`min-h-touch rounded-lg border px-3 py-2 font-semibold ${
                translatorMode === "g1"
                  ? "bg-primary-600 border-primary-300 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-300"
              }`}
              aria-pressed={translatorMode === "g1"}
            >
              Grade 1 (debug)
            </button>
            <button
              type="button"
              onClick={() => setTranslatorMode("g2")}
              className={`min-h-touch rounded-lg border px-3 py-2 font-semibold ${
                translatorMode === "g2"
                  ? "bg-primary-600 border-primary-300 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-300"
              }`}
              aria-pressed={translatorMode === "g2"}
              aria-describedby="translator-help"
            >
              Grade 2 (Liblouis)
            </button>
          </div>
          <p id="translator-help" className="text-sm text-gray-300 mt-2">
            Grade 1 uses the bundled debug mapping. Grade 2 loads Liblouis on demand —
            first use downloads about 1.6 MB.
          </p>

          {translatorMode === "g2" && (
            <fieldset className="mt-3">
              <legend className="text-sm font-semibold text-gray-200 mb-2">Language</legend>
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
                    onClick={() => setLanguage(option.id)}
                    className={`min-h-touch rounded-lg border px-3 py-2 font-semibold text-sm ${
                      language === option.id
                        ? "bg-primary-600 border-primary-300 text-white"
                        : "bg-gray-900 border-gray-700 text-gray-300"
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
            <p className="text-sm text-red-300 mt-2" role="alert">
              Liblouis failed ({translatorError}). Falling back to Grade 1.
            </p>
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
                className={`min-h-touch rounded-lg border px-3 py-2 font-semibold ${
                  groupSize === size
                    ? "bg-primary-600 border-primary-300 text-white"
                    : "bg-gray-900 border-gray-700 text-gray-300"
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
              className={`min-h-touch rounded-lg border px-3 py-2 font-semibold ${
                outputFormat === "compact"
                  ? "bg-primary-600 border-primary-300 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-300"
              }`}
              aria-pressed={outputFormat === "compact"}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => setOutputFormat("json")}
              className={`min-h-touch rounded-lg border px-3 py-2 font-semibold ${
                outputFormat === "json"
                  ? "bg-primary-600 border-primary-300 text-white"
                  : "bg-gray-900 border-gray-700 text-gray-300"
              }`}
              aria-pressed={outputFormat === "json"}
            >
              JSON
            </button>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-3 items-center">
            <label htmlFor="hold-ms" className="text-gray-300">
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
                className="w-24 bg-gray-900 text-white border border-gray-700 rounded-lg px-3 py-2"
                aria-describedby="hold-ms-unit"
              />
              <span id="hold-ms-unit" className="text-gray-300" aria-label="milliseconds">
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
            <span className="text-gray-300">Blank pins between frames</span>
          </label>

          <div className="mt-4">
            <Button
              variant="secondary"
              onClick={sendHid}
              aria-label="Send to a connected HID braille display"
              className="w-full"
            >
              <IconBraille className="w-5 h-5 inline mr-1" /> Send to HID braille display
            </Button>
            <p className="text-xs text-gray-400 mt-2">
              WebHID requires Chrome/Edge over HTTPS. Pick a braille display when prompted.
            </p>
          </div>
        </section>

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
            className="bg-gray-950 border border-gray-700 rounded-xl p-4"
            aria-label={`${cells.length} braille cells generated`}
          >
            <p className="text-4xl leading-relaxed break-words" lang="zxx">
              {braillePreview || "No cells"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
              <span className="text-gray-400 block">Cells</span>
              <span className="text-white text-xl font-bold">{cells.length}</span>
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-3">
              <span className="text-gray-400 block">Frames</span>
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
            <p className="text-gray-400 text-sm mt-2">{cells.length - 32} more cells in JSON output.</p>
          )}
        </section>

        <section aria-labelledby="output-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="output-heading" className="text-lg font-semibold text-white">
              Output
            </h2>
            <span className="text-sm text-gray-400">
              {outputFormat === "json" ? "JSON Lines" : "Firmware text"}
            </span>
          </div>
          <textarea
            readOnly
            value={activeOutput}
            className="w-full min-h-48 bg-gray-950 text-gray-200 border border-gray-700 rounded-xl px-3 py-3 font-mono text-xs"
            aria-label="Generated tactile frame output"
          />
        </section>
      </div>

      <div className="fixed bottom-16 left-0 right-0 bg-gray-900/95 backdrop-blur border-t border-gray-700 px-4 py-3">
        <div className="max-w-lg mx-auto grid grid-cols-3 gap-2">
          <Button variant="secondary" onClick={copyFrames} aria-keyshortcuts="C">
            Copy (C)
          </Button>
          <Button variant="secondary" onClick={saveFrames} aria-keyshortcuts="S">
            <IconUpload className="w-5 h-5 inline mr-1" /> Save (S)
          </Button>
          <Button onClick={sendSerial} aria-keyshortcuts="N">
            <IconBraille className="w-5 h-5 inline mr-1" /> Send (N)
          </Button>
        </div>
        <p className="max-w-lg mx-auto text-center text-xs text-gray-400 mt-2">
          Keyboard: C copy, S save, N send, V speak preview. F6 anywhere for voice.
        </p>
      </div>
    </div>
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
      className="bg-gray-900 border border-gray-700 rounded-lg p-2"
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
                : "bg-gray-800 border-gray-600"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
      <p className="text-center text-xs text-gray-400 mt-2 truncate">
        {cell.source === " " ? "space" : cell.source}
      </p>
    </div>
  );
}
