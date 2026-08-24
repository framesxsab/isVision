import type { FrameSink } from "../plugin";
import { registerSink } from "../registry";

export class ExampleBluetoothDevice implements FrameSink {
  name = "example-bluetooth";
  onFrame(masks: number[], cellStart: number, index: number) {
    console.log(`[example-bluetooth] ${index} @${cellStart}`, masks);
  }
}

registerSink(
  { name: "example-bluetooth", version: "0.1.0", sink: "example-bluetooth", capabilities: ["bluetooth"], cells: 4, dots: 6, requires: ["WebBluetooth"] },
  () => new ExampleBluetoothDevice()
);
