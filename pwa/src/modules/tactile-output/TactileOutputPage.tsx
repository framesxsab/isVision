import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { IconArrowLeft, IconBraille, IconRefresh, IconUpload } from "@/components/Icons";
import { useAnnounce } from "@/core/a11y/AriaLive";
import { speechEngine } from "@/core/audio/SpeechEngine";
import {
  buildTactileFrames,
  serializeCompactFrames,
  serializeFrames,
  translateGrade1Debug,
  type TactileFrame,
} from "./brailleFrames";

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
const GROUP_SIZES = [1, 4, 8];
type OutputFormat = "json" | "compact";

export default function TactileOutputPage() {
  const navigate = useNavigate();
  const announce = useAnnounce();
  const [text, setText] = useState(DEFAULT_TEXT);
  const [groupSize, setGroupSize] = useState(1);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>("compact");
  const [holdMs, setHoldMs] = useState(900);
  const [blankBetweenFrames, setBlankBetweenFrames] = useState(true);
  const [status, setStatus] = useState("Ready");

  const cells = useMemo(() => translateGrade1Debug(text), [text]);
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

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <Button variant="ghost" onClick={() => navigate("/")} aria-label="Go back to home">
            <IconArrowLeft className="w-5 h-5 inline mr-1" /> Back
          </Button>
          <h1 className="text-lg font-bold text-white">Tactile Lab</h1>
          <span className="text-sm text-gray-400 w-20 text-right" role="status">
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
            <Button variant="ghost" onClick={() => setText(DEFAULT_TEXT)} aria-label="Reset text">
              <IconRefresh className="w-5 h-5" />
            </Button>
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
            <input
              id="hold-ms"
              type="number"
              min={100}
              max={5000}
              step={50}
              value={holdMs}
              onChange={(event) => setHoldMs(Math.max(100, Math.min(5000, Number(event.target.value) || 900)))}
              className="w-28 bg-gray-900 text-white border border-gray-700 rounded-lg px-3 py-2"
              aria-describedby="hold-ms-unit"
            />
            <span id="hold-ms-unit" className="sr-only">milliseconds</span>
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
        </section>

        <section aria-labelledby="preview-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="preview-heading" className="text-lg font-semibold text-white">
              Braille Preview
            </h2>
            <Button variant="secondary" onClick={speakPreview}>
              Speak
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
            <p className="text-gray-500 text-sm mt-2">{cells.length - 32} more cells in JSON output.</p>
          )}
        </section>

        <section aria-labelledby="output-heading">
          <div className="flex items-center justify-between mb-3">
            <h2 id="output-heading" className="text-lg font-semibold text-white">
              Output
            </h2>
            <span className="text-sm text-gray-500">
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
          <Button variant="secondary" onClick={copyFrames}>
            Copy
          </Button>
          <Button variant="secondary" onClick={saveFrames}>
            <IconUpload className="w-5 h-5 inline mr-1" /> Save
          </Button>
          <Button onClick={sendSerial}>
            <IconBraille className="w-5 h-5 inline mr-1" /> Send
          </Button>
        </div>
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
