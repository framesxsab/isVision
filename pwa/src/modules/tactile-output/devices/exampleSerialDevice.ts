import type { FrameSink } from "../plugin";
import { registerSink } from "../registry";

export class ExampleSerialDevice implements FrameSink {
  name = "example-serial";
  onFrame(masks: number[], cellStart: number, index: number) {
    console.log(`[example-serial] ${index} @${cellStart}`, masks);
  }
}

registerSink(
  { name: "example-serial", version: "0.1.0", sink: "example-serial", capabilities: ["serial"], cells: 8, dots: 8, requires: ["WebSerial"] },
  () => new ExampleSerialDevice()
);
