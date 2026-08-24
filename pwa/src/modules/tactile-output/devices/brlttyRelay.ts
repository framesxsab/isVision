import type { FrameSink } from "../plugin";
import { registerSink } from "../registry";

export class BRLTTYRelay implements FrameSink {
  name = "brltty-relay";
  note = "Relay to running BRLTTY daemon via tools/tactile_serve.py --out brltty (not a driver)";

  onFrame(masks: number[], cellStart: number, index: number) {
    console.log(`[BRLTTY relay] frame ${index} @${cellStart}:`, masks);
  }
}

registerSink(
  { name: "brltty-relay", version: "0.1.0", sink: "brltty", capabilities: ["brlapi-relay"], cells: 40, dots: 8, requires: [] },
  () => new BRLTTYRelay()
);
