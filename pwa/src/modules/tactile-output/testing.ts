import { MockDevice } from "./devices/mockDevice";
import { deviceManager } from "./deviceManager";

export function withMockDevice(fn: (mock: MockDevice) => void) {
  const mock = new MockDevice();
  deviceManager.setSink(mock);
  fn(mock);
  deviceManager.disconnect();
}

export function assertFrameCount(mock: MockDevice, expected: number) {
  if (mock.frames.length !== expected) throw new Error(`Expected ${expected} frames, got ${mock.frames.length}`);
}
