import { describe, it, expect } from "vitest";
import { HIDDevice } from "./devices/hidDevice";
import { deviceManager } from "./deviceManager";

describe("HIDDevice", () => {
  it("graceful fallback when HID unavailable", async () => {
    const hid = new HIDDevice();
    const orig = (navigator as unknown as { hid?: unknown }).hid;
    try {
      // simulate unsupported
      (navigator as unknown as { hid?: unknown }).hid = undefined as unknown as never;
      const res = await hid.requestDevice();
      expect(res).toBeNull();
    } finally {
      (navigator as unknown as { hid?: unknown }).hid = orig as never;
    }
  });

  it("auto-detect reports empty when no device", () => {
    const hid = new HIDDevice();
    expect(hid.getReports()).toEqual([]);
  });

  it("hot-swap via MockDevice and VirtualDevice without HID", async () => {
    await deviceManager.connect("mock");
    expect(deviceManager.getCurrentName()).toBe("mock");
    await deviceManager.connect("virtual");
    expect(deviceManager.getCurrentName()).toBe("virtual");
    deviceManager.disconnect();
    expect(deviceManager.getCurrentName()).toBeNull();
  });

  it("permission-denied simulated as unsupported", () => {
    const hid = new HIDDevice();
    // no permission prompt in test — just verify onFrame no-throw when not opened
    expect(() => hid.onFrame([1, 2], 0, 0)).not.toThrow();
    expect(() => hid.onBlank()).not.toThrow();
  });
});
