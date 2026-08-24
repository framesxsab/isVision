import type { FrameSink } from "../plugin";
import { registerSink } from "../registry";

export class VirtualDevice implements FrameSink {
  name = "virtual";
  lastMasks: number[] = [];

  onFrame(masks: number[], _cellStart: number, _index: number) {
    this.lastMasks = [...masks];
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("virtual-device-frame", { detail: { masks } }));
    }
  }
  onBlank() {
    this.lastMasks = [];
  }
}

registerSink(
  { name: "virtual", version: "0.1.0", sink: "virtual", capabilities: ["virtual-emulator"], cells: 8, dots: 8, requires: [] },
  () => new VirtualDevice()
);
