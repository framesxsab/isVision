/**
 * TactileGraphicsPage — Phase 4 "Spatial tactile output" prototype.
 *
 * Turns an uploaded image into a low-resolution pin matrix that renders on a
 * braille-cell display, segments the raised pins into labeled regions, and
 * produces compact-protocol frames playable on the same serial/HID hardware as
 * the Tactile Lab.
 */

import { useMemo, useRef, useState } from "react";
import { detectWebHid, detectWebSerial } from "@/core/utils/capabilities";
import { Button } from "@/components/Button";
import { IconUpload } from "@/components/Icons";
import { PageShell, sectionCard, toggleActive, toggleInactive } from "@/components/PageShell";
import {
  DEFAULT_CELL_COLS,
  DEFAULT_CELL_ROWS,
  buildGraphicsFrames,
  describeRegions,
  detectRegions,
  luminancePixelsToMatrix,
  matrixToAscii,
  pinDensity,
  pinMatrixToCellMasks,
  type PinMatrix,
} from "./graphicsConverter";
import { serializeCompactFrames } from "../tactile-output/brailleFrames";

interface SerialPortLike {
  open(options: { baudRate: number }): Promise<void>;
  writable: WritableStream | null;
  close(): Promise<void>;
}

interface NavigatorWithSerial extends Navigator {
  serial?: { requestPort(): Promise<SerialPortLike> };
}

const SERIAL_BAUD_RATE = 115200;
const SERIAL_FRAME_MARGIN_MS = 20;

const CELL_COL_OPTIONS = [4, 8, 12];
const CELL_ROW_OPTIONS = [2, 4, 6];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// Local section label in stone-400: the shared SectionLabel uses stone-500,
// which fails AA contrast inside the lighter sectionCard surface used here.
function CardLabel({ label }: { label: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400 mb-3">
      {label}
    </h2>
  );
}

export default function TactileGraphicsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sourceName, setSourceName] = useState("");
  const [status, setStatus] = useState("Upload an image to convert it to a tactile pin matrix.");
  const [cellsPerRow, setCellsPerRow] = useState(DEFAULT_CELL_COLS);
  const [cellRows, setCellRows] = useState(DEFAULT_CELL_ROWS);
  const [threshold, setThreshold] = useState(128);
  const [matrix, setMatrix] = useState<PinMatrix | null>(null);
  const [imageData, setImageData] = useState<{ pixels: Uint8ClampedArray; width: number; height: number } | null>(null);

  const serialCap = useMemo(() => detectWebSerial(), []);
  const hidCap = useMemo(() => detectWebHid(), []);

  const pinCols = cellsPerRow * 2;
  const pinRows = cellRows * 4;

  const updateStatus = (message: string) => {
    // The visible role="status" paragraph already announces; calling
    // announce() too would make screen readers speak every message twice.
    setStatus(message);
  };

  // Re-run the conversion with the given settings. Grid controls and the
  // threshold slider reconvert live so a change never leaves a stale matrix
  // whose dimensions no longer match the selected grid.
  const reconvert = (opts: { cellsPerRow?: number; cellRows?: number; threshold?: number }) => {
    if (!imageData) return;
    const cols = (opts.cellsPerRow ?? cellsPerRow) * 2;
    const rows = (opts.cellRows ?? cellRows) * 4;
    const next = luminancePixelsToMatrix(
      imageData.pixels,
      imageData.width,
      imageData.height,
      cols,
      rows,
      opts.threshold ?? threshold
    );
    setMatrix(next);
  };

  const onFileChosen = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      updateStatus(`${file.name} is not an image. Upload a PNG, JPEG, SVG, or WebP file.`);
      return;
    }

    try {
      // CSP (img-src 'self' data: https:) blocks blob: images, so load the
      // file through a data: URL instead of URL.createObjectURL.
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("The image could not be read."));
        reader.readAsDataURL(file);
      });

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("The image could not be decoded."));
        img.src = dataUrl;
      });

      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas rendering is not available.");
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);

      setSourceName(file.name);
      setImageData({ pixels: data.data, width: canvas.width, height: canvas.height });
      updateStatus(`Loaded ${file.name} (${canvas.width}x${canvas.height}).`);
    } catch (err) {
      updateStatus(err instanceof Error ? err.message : "Could not read that image.");
    }
  };

  const convert = () => {
    if (!imageData) {
      updateStatus("Upload an image first.");
      return;
    }
    reconvert({});
    const next = luminancePixelsToMatrix(
      imageData.pixels,
      imageData.width,
      imageData.height,
      pinCols,
      pinRows,
      threshold
    );
    const regions = detectRegions(next);
    const density = Math.round(pinDensity(next) * 100);
    const summary = `${sourceName}: ${describeRegions(regions)} Ink density ${density} percent.`;
    updateStatus(summary);
  };

  const maskRows = useMemo(() => (matrix ? pinMatrixToCellMasks(matrix, cellsPerRow) : []), [matrix, cellsPerRow]);
  const frames = useMemo(() => buildGraphicsFrames(maskRows, cellsPerRow), [maskRows, cellsPerRow]);
  const regions = useMemo(() => (matrix ? detectRegions(matrix) : []), [matrix]);

  const braillePreview = frames
    .map((frame) => frame.cells.map((cell) => cell.unicode).join(" "))
    .join("\n");

  const compactText = useMemo(
    () => (frames.length > 0 ? serializeCompactFrames(frames, { holdMs: 900, blankBetweenFrames: true }) : ""),
    [frames]
  );

  const copyProtocol = async () => {
    if (!compactText) return;
    try {
      await navigator.clipboard.writeText(compactText);
      updateStatus(`Copied ${frames.length} frame${frames.length === 1 ? "" : "s"} of compact protocol.`);
    } catch {
      updateStatus("Clipboard copy was blocked. Select the text below and copy it manually.");
    }
  };

  const sendHid = async () => {
    if (!matrix) {
      updateStatus("Convert an image first.");
      return;
    }
    if (!hidCap.available) {
      updateStatus(`${hidCap.reason} ${hidCap.suggestion}`);
      return;
    }
    const { sendBraille } = await import("../tactile-output/webHidAdapter");
    const cells = frames.flatMap((frame) => frame.cells);
    const result = await sendBraille(cells);
    updateStatus(result.message);
  };

  const sendSerial = async () => {
    if (!compactText) {
      updateStatus("Convert an image first.");
      return;
    }
    if (!serialCap.available) {
      updateStatus(`${serialCap.reason} ${serialCap.suggestion}`);
      return;
    }
    const serial = (navigator as NavigatorWithSerial).serial!;
    let port: SerialPortLike | null = null;
    let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
    try {
      port = await serial.requestPort();
      await port.open({ baudRate: SERIAL_BAUD_RATE });
      if (!port.writable) throw new Error("Serial port is not writable.");
      writer = port.writable.getWriter();
      const encoder = new TextEncoder();
      for (const line of compactText.split(/\r?\n/)) {
        await writer.write(encoder.encode(`${line}\n`));
        if (line.startsWith("F ")) await sleep(900 + SERIAL_FRAME_MARGIN_MS);
      }
      updateStatus(`Sent ${frames.length} graphic frames over serial.`);
    } catch (err) {
      updateStatus(err instanceof Error ? err.message : "Serial send failed.");
    } finally {
      writer?.releaseLock();
      await port?.close().catch(() => undefined);
    }
  };

  const dotGrid = matrix ? matrixToAscii(matrix) : "";
  const gridLabel = matrix
    ? `Raised pin preview, ${pinCols} columns and ${pinRows} rows`
    : "";

  return (
    <PageShell title="Tactile Graphics" accent="rose" width="wide">
      <div className="flex-1 px-4 sm:px-6 lg:px-10 py-8 max-w-5xl mx-auto w-full space-y-8 pb-nav-action">
        <section aria-labelledby="graphics-intro" className={sectionCard}>
          <CardLabel label="What this does" />
          <p id="graphics-intro" className="text-stone-300 text-sm leading-relaxed">
            Convert a chart, map, or diagram into a low-resolution tactile pin matrix that
            plays on a braille-cell display. Dark areas become raised pins. Use a simple image
            with bold shapes for the clearest result.
          </p>
        </section>

        {/* Upload + grid controls */}
        <section aria-labelledby="source-heading" className={sectionCard}>
          <CardLabel label="1 · Source" />
          <div className="space-y-5">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={onFileChosen}
                aria-label="Upload an image"
              />
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto"
              >
                <IconUpload className="w-5 h-5 mr-2 inline-block" />
                {sourceName ? `Replace ${sourceName}` : "Upload an image"}
              </Button>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-stone-200 mb-3">
                Cells per row ({pinCols} pins wide)
              </legend>
              <div className="flex flex-wrap gap-2">
                {CELL_COL_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setCellsPerRow(option);
                      reconvert({ cellsPerRow: option });
                    }}
                    aria-pressed={cellsPerRow === option}
                    className={cellsPerRow === option ? toggleActive : toggleInactive}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium text-stone-200 mb-3">
                Cell rows ({pinRows} pins tall)
              </legend>
              <div className="flex flex-wrap gap-2">
                {CELL_ROW_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setCellRows(option);
                      reconvert({ cellRows: option });
                    }}
                    aria-pressed={cellRows === option}
                    className={cellRows === option ? toggleActive : toggleInactive}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>

            <div>
              <label
                htmlFor="graphics-threshold"
                className="block text-sm font-medium text-stone-200 mb-2"
              >
                Ink threshold: {threshold}
              </label>
              <input
                id="graphics-threshold"
                type="range"
                min={0}
                max={255}
                value={threshold}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  setThreshold(value);
                  reconvert({ threshold: value });
                }}
                className="w-full"
              />
              <p className="text-xs text-stone-400 mt-1">
                Lower values only raise pins for darker ink; higher values are more sensitive.
              </p>
            </div>

            <Button onClick={convert} disabled={!imageData}>
              Convert to pin matrix
            </Button>
            <p role="status" aria-live="polite" className="text-sm text-stone-400 mt-3">
              {status}
            </p>
          </div>
        </section>

        {/* Result */}
        {matrix && (
          <>
            <section aria-labelledby="preview-heading" className={sectionCard}>
              <CardLabel label="2 · Pin preview" />
              <div className="flex flex-col sm:flex-row gap-6">
                <div
                  role="img"
                  aria-label={gridLabel}
                  className="font-mono text-[10px] leading-[1.15] text-stone-300 bg-surface-2 border border-surface-border rounded-xl p-4 select-none overflow-x-auto"
                >
                  <pre className="whitespace-pre">{dotGrid}</pre>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 id="preview-heading" className="sr-only">
                    Pin matrix and regions
                  </h3>
                  <p className="text-sm text-stone-300 mb-3">
                    Raised pins are shown as <span className="font-mono text-stone-100">#</span>.
                  </p>
                </div>
              </div>
            </section>

            <section aria-labelledby="regions-heading" className={sectionCard}>
              <h2 id="regions-heading" className="sr-only">
                Detected regions
              </h2>
              <CardLabel label="3 · Regions" />
              {regions.length === 0 ? (
                <p className="text-sm text-stone-400">No raised regions found — try lowering the threshold.</p>
              ) : (
                <ul aria-label="Detected regions" className="space-y-2">
                  {regions.map((region) => (
                    <li
                      key={region.label}
                      className="flex flex-wrap justify-between items-center gap-2 bg-surface-2 border border-surface-border rounded-xl px-4 py-3"
                      aria-label={`Region ${region.label}, ${region.pinCount} raised pins, ${Math.round(
                        region.center.x * 100
                      )} percent from left, ${Math.round(region.center.y * 100)} percent from top`}
                    >
                      <span className="text-stone-100 font-semibold text-sm">Region {region.label}</span>
                      <span className="text-stone-400 text-sm">
                        {region.pinCount} pins · {region.bounds.width}x{region.bounds.height} block
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="output-heading" className={sectionCard}>
              <h2 id="output-heading" className="sr-only">
                Braille and protocol output
              </h2>
              <CardLabel label="4 · Output" />
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-stone-200 mb-2">Braille preview</p>
                  <pre
                    className="text-lg text-stone-200 bg-surface-2 border border-surface-border rounded-xl px-4 py-3 overflow-x-auto whitespace-pre"
                    aria-label="Braille cell preview"
                  >
                    {braillePreview}
                  </pre>
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-200 mb-2">Compact protocol</p>
                  <textarea
                    readOnly
                    value={compactText}
                    aria-label="Compact protocol output"
                    rows={Math.max(4, frames.length + 3)}
                    className="w-full bg-surface-1 text-stone-100 border border-surface-border rounded-xl px-4 py-3 font-mono text-xs leading-relaxed"
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button variant="secondary" onClick={copyProtocol} disabled={!compactText}>
                    Copy protocol
                  </Button>
                  <Button variant="secondary" onClick={sendSerial} disabled={!compactText || !serialCap.available}>
                    {serialCap.available ? "Send over serial" : `${serialCap.reason} ${serialCap.suggestion}`}
                  </Button>
                  <Button variant="secondary" onClick={sendHid} disabled={!matrix || !hidCap.available}>
                    {hidCap.available ? "Send to HID display" : `${hidCap.reason} ${hidCap.suggestion}`}
                  </Button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </PageShell>
  );
}
