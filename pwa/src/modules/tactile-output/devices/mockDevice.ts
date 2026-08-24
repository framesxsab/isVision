import type { FrameSink } from "../plugin";
import { registerSink } from "../registry";

export class MockDevice implements FrameSink {
  name = "mock";
  frames: Array<{ masks: number[]; cellStart: number; index: number }> = [];
  config: { holdMs: number; blankBetweenFrames: boolean } | null = null;

  onConfig(c: { holdMs: number; blankBetweenFrames: boolean }) {
    this.config = c;
  }
  onFrame(masks: number[], cellStart: number, index: number) {
    this.frames.push({ masks: [...masks], cellStart, index });
  }
  onBlank() {
    this.frames.push({ masks: [], cellStart: -1, index: -1 });
  }
}

registerSink(
  { name: "mock", version: "0.1.0", sink: "mock", capabilities: ["mock"], cells: 40, dots: 8, requires: [] },
  () => new MockDevice()
);
