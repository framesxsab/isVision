import type { FrameSink } from "./plugin";

export type DeviceManifest = {
  name: string;
  version: string;
  sink: string;
  capabilities: string[];
  cells: number;
  dots: 8 | 6;
  requires?: string[];
};

export type DeviceDescriptor = {
  manifest: DeviceManifest;
  factory: () => FrameSink;
  available: boolean;
  reason: string;
};

const store = new Map<string, { manifest: DeviceManifest; factory: () => FrameSink }>();

export function registerSink(manifest: DeviceManifest, factory: () => FrameSink) {
  store.set(manifest.name, { manifest, factory });
}

export function autoDiscover(): DeviceDescriptor[] {
  return Array.from(store.values()).map(({ manifest, factory }) => {
    let available = true;
    let reason = "available";
    for (const req of manifest.requires ?? []) {
      if (req === "WebSerial" && (typeof navigator === "undefined" || !("serial" in navigator))) {
        available = false;
        reason = "Web Serial not supported";
      }
      if (req === "WebHID" && (typeof navigator === "undefined" || !("hid" in navigator))) {
        available = false;
        reason = "WebHID not supported";
      }
      if (req === "WebBluetooth" && (typeof navigator === "undefined" || !("bluetooth" in navigator))) {
        available = false;
        reason = "Web Bluetooth not supported";
      }
    }
    return { manifest, factory, available, reason };
  });
}

export function getAvailableSinks(): DeviceDescriptor[] {
  return autoDiscover().filter((d) => d.available);
}

export const defaultRegistry = { registerSink, autoDiscover, getAvailableSinks };

export function parseManifest(raw: unknown): DeviceManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string" || typeof o.sink !== "string") return null;
  return o as DeviceManifest;
}
