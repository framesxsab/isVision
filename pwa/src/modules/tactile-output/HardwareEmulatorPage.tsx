// Hardware Emulator — visual playback of the compact tactile protocol so
// contributors can verify exported frames without owning a refreshable
// braille display. Per docs/development-improvement-spec.md P2: load text,
// step through frames at 1/4/8 cells, report line-level parse errors.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Button";
import { IconArrowLeft } from "@/components/Icons";
import { useAnnounce } from "@/core/a11y/AriaLive";
import {
  parseCompactProtocol,
  type BrailleCell,
  type TactileFrame,
} from "./brailleFrames";

const SAMPLE = [
  "# Paste an exported compact protocol below. Try the sample:",
  "CFG hold_ms=900 blank=1",
  "F 0 0 32 1",
  "B",
  "F 1 2 3 9",
  "B",
  "F 2 4 25 17",
  "END",
].join("\n");

const CELL_WIDTHS = [1, 4, 8] as const;
const SPEEDS = [0.5, 1, 2, 4] as const;

type CellWidth = (typeof CELL_WIDTHS)[number];
type Speed = (typeof SPEEDS)[number];

export default function HardwareEmulatorPage() {
  const navigate = useNavigate();
  const announce = useAnnounce();

  const [input, setInput] = useState(SAMPLE);
  const [cellWidth, setCellWidth] = useState<CellWidth>(8);
  const [speed, setSpeed] = useState<Speed>(1);
  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const playTimer = useRef<number | null>(null);

  const parsed = useMemo(() => parseCompactProtocol(input), [input]);
  const frames = parsed.frames;
  const totalFrames = frames.length;
  const currentFrame = frames[position];

  // Reset position if the input shrinks past it.
  useEffect(() => {
    if (position >= totalFrames) {
      setPosition(0);
      setPlaying(false);
    }
  }, [totalFrames, position]);

  const stepInterval = useMemo(() => {
    const base = parsed.options.holdMs > 0 ? parsed.options.holdMs : 900;
    return Math.max(50, base / speed);
  }, [parsed.options.holdMs, speed]);

  // Playback driver. Schedules the next step from inside the tick so that
  // changing speed or pausing takes effect immediately, not after the next
  // interval boundary.
  useEffect(() => {
    if (!playing) return;
    if (totalFrames === 0) {
      setPlaying(false);
      return;
    }
    playTimer.current = window.setTimeout(() => {
      setPosition((p) => {
        const next = p + 1;
        if (next >= totalFrames) {
          if (loop) return 0;
          setPlaying(false);
          return p;
        }
        return next;
      });
    }, stepInterval);
    return () => {
      if (playTimer.current !== null) {
        window.clearTimeout(playTimer.current);
        playTimer.current = null;
      }
    };
  }, [playing, position, totalFrames, stepInterval, loop]);

  const onTogglePlay = useCallback(() => {
    if (totalFrames === 0) return;
    setPlaying((p) => {
      const next = !p;
      announce(next ? "Playback started." : "Playback paused.");
      return next;
    });
  }, [announce, totalFrames]);

  const stepBy = useCallback(
    (delta: number) => {
      if (totalFrames === 0) return;
      setPlaying(false);
      setPosition((p) => {
        const next = p + delta;
        if (next < 0) return loop ? totalFrames - 1 : 0;
        if (next >= totalFrames) return loop ? 0 : totalFrames - 1;
        return next;
      });
    },
    [totalFrames, loop]
  );

  const onReset = useCallback(() => {
    setPlaying(false);
    setPosition(0);
    announce("Reset to first frame.");
  }, [announce]);

  // Spoken summary of the current frame for screen-reader users — the visual
  // dot grid is meaningless without this.
  useEffect(() => {
    if (!currentFrame) return;
    const dots = currentFrame.cells
      .map((cell, i) => `cell ${i + 1}: ${cell.dots.length ? cell.dots.join(" ") : "blank"}`)
      .join("; ");
    announce(`Frame ${currentFrame.index + 1} of ${totalFrames}. ${dots}.`);
  }, [currentFrame, totalFrames, announce]);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 bg-gray-900/95 backdrop-blur border-b border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between max-w-2xl mx-auto">
          <Button variant="ghost" onClick={() => navigate(-1)} aria-label="Back">
            <IconArrowLeft className="w-5 h-5 inline mr-1" /> Back
          </Button>
          <h1 className="text-lg font-bold text-white">Hardware Emulator</h1>
          <div className="w-16" />
        </div>
      </header>

      <div className="flex-1 px-4 py-5 pb-nav max-w-2xl mx-auto w-full space-y-6">
        <section aria-label="Compact protocol input">
          <label htmlFor="emulator-input" className="block text-sm font-medium text-stone-100 mb-2">
            Compact protocol
          </label>
          <textarea
            id="emulator-input"
            data-testid="emulator-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            className="w-full h-48 font-mono text-sm bg-surface-1 border border-surface-border rounded-xl p-3 text-stone-50 focus-visible:ring-2 focus-visible:ring-primary-400"
            aria-describedby="emulator-input-hint"
          />
          <p id="emulator-input-hint" className="text-xs text-stone-400 mt-2">
            Paste the output of the Tactile Lab compact export, or edit by hand.
            Lines starting with # are comments.
          </p>
        </section>

        {parsed.errors.length > 0 && (
          <section
            aria-label="Parse errors"
            data-testid="emulator-errors"
            className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4"
          >
            <p className="text-rose-100 font-semibold mb-2">
              {parsed.errors.length} parse {parsed.errors.length === 1 ? "issue" : "issues"}
            </p>
            <ul className="space-y-2 text-sm">
              {parsed.errors.map((err, i) => (
                <li key={i} className="text-stone-100">
                  <span className="font-mono text-rose-200">Line {err.line}:</span>{" "}
                  {err.message}
                  {err.content && (
                    <pre className="mt-1 text-xs text-stone-300 whitespace-pre-wrap">
                      {err.content}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-label="Playback controls" className="space-y-4">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Cell width">
            {CELL_WIDTHS.map((w) => (
              <button
                key={w}
                type="button"
                aria-pressed={cellWidth === w}
                onClick={() => setCellWidth(w)}
                className={`min-h-touch px-4 py-2 rounded-lg text-sm font-medium border focus-visible:ring-2 focus-visible:ring-primary-400 ${
                  cellWidth === w
                    ? "bg-primary-600 border-primary-400 text-white"
                    : "bg-surface-2 border-surface-border text-stone-100 hover:bg-surface-3"
                }`}
              >
                {w}-cell
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Speed">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={speed === s}
                onClick={() => setSpeed(s)}
                className={`min-h-touch px-3 py-2 rounded-lg text-sm font-medium border focus-visible:ring-2 focus-visible:ring-primary-400 ${
                  speed === s
                    ? "bg-primary-600 border-primary-400 text-white"
                    : "bg-surface-2 border-surface-border text-stone-100 hover:bg-surface-3"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => stepBy(-1)}
              disabled={totalFrames === 0}
              aria-label="Step backward one frame"
            >
              Step back
            </Button>
            <Button
              variant="primary"
              onClick={onTogglePlay}
              disabled={totalFrames === 0}
              aria-label={playing ? "Pause playback" : "Start playback"}
              data-testid="emulator-play"
            >
              {playing ? "Pause" : "Play"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => stepBy(1)}
              disabled={totalFrames === 0}
              aria-label="Step forward one frame"
              data-testid="emulator-step"
            >
              Step forward
            </Button>
            <Button variant="ghost" onClick={onReset} disabled={totalFrames === 0} aria-label="Reset to first frame">
              Reset
            </Button>
            <label className="inline-flex items-center gap-2 text-sm text-stone-100 ml-auto">
              <input
                type="checkbox"
                checked={loop}
                onChange={(e) => setLoop(e.target.checked)}
                className="w-5 h-5 accent-primary-500"
              />
              Loop
            </label>
          </div>
        </section>

        <section
          aria-label="Frame display"
          className="rounded-2xl border border-surface-border bg-surface-1 p-4"
          data-testid="emulator-display"
        >
          <p className="text-sm text-stone-300 mb-3">
            {totalFrames === 0
              ? "No frames to display."
              : `Frame ${position + 1} of ${totalFrames} — cellStart ${currentFrame?.cellStart ?? 0}`}
          </p>
          <div className="flex items-end gap-2 overflow-x-auto py-2" data-testid="emulator-cells">
            {renderCells(currentFrame, cellWidth)}
          </div>
        </section>
      </div>
    </div>
  );
}

// Render a row of cells padded out to the selected width so the visual matches
// what the hardware will physically display — empty positions show as blank
// cells, not as nothing.
function renderCells(frame: TactileFrame | undefined, width: CellWidth) {
  const cells = frame?.cells ?? [];
  const padded: (BrailleCell | null)[] = [];
  for (let i = 0; i < Math.max(width, cells.length); i++) {
    padded.push(cells[i] ?? null);
  }
  return padded.map((cell, i) => <Cell key={i} cell={cell} />);
}

function Cell({ cell }: { cell: BrailleCell | null }) {
  const active = (dot: number) => (cell ? cell.dots.includes(dot) : false);
  return (
    <div
      className="grid grid-cols-2 gap-1 p-2 rounded-lg bg-surface-2 border border-surface-border"
      aria-hidden="true"
    >
      {[1, 4, 2, 5, 3, 6, 7, 8].map((dot) => (
        <span
          key={dot}
          className={`w-4 h-4 rounded-full border ${
            active(dot)
              ? "bg-primary-400 border-primary-200 shadow-[0_0_8px_currentColor] text-primary-100"
              : "bg-surface-1 border-surface-border"
          }`}
        />
      ))}
    </div>
  );
}
