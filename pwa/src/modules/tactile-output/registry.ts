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
const enabled = new Map<string, boolean>();

export function registerSink(manifest: DeviceManifest, factory: () => FrameSink) {
  if (!isVersionCompatible(manifest.version)) {
    console.warn(`Plugin ${manifest.name} version ${manifest.version} incompatible`);
    return;
  }
  const dep = validateDependencies(manifest);
  if (!dep.ok) {
    console.warn(`Plugin ${manifest.name} missing dependencies: ${dep.missing.join(", ")}`);
  }
  store.set(manifest.name, { manifest, factory });
  if (!enabled.has(manifest.name)) enabled.set(manifest.name, true);
}

export function setEnabled(name: string, on: boolean) {
  if (store.has(name)) enabled.set(name, on);
}

export function isEnabled(name: string): boolean {
  return enabled.get(name) ?? true;
}

export function isVersionCompatible(version: string): boolean {
  if (!version) return true;
  const major = parseInt(version.split(".")[0] ?? "0", 10);
  return major === 0 || major === 1;
}

export function validateDependencies(manifest: DeviceManifest): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const req of manifest.requires ?? []) {
    if (req === "WebSerial" && (typeof navigator === "undefined" || !("serial" in navigator))) missing.push(req);
    if (req === "WebHID" && (typeof navigator === "undefined" || !("hid" in navigator))) missing.push(req);
    if (req === "WebBluetooth" && (typeof navigator === "undefined" || !("bluetooth" in navigator))) missing.push(req);
  }
  return { ok: missing.length === 0, missing };
}

export function autoDiscover(): DeviceDescriptor[] {
  return Array.from(store.entries()).map(([name, { manifest, factory }]) => {
    let available = true;
    let reason = "available";
    if (!isEnabled(name)) {
      available = false;
      reason = "disabled";
    } else {
      const dep = validateDependencies(manifest);
      if (!dep.ok) {
        available = false;
        reason = dep.missing.join(", ") + " not supported";
      }
    }
    return { manifest, factory, available, reason };
  });
}

export function getAvailableSinks(): DeviceDescriptor[] {
  return autoDiscover().filter((d) => d.available);
}

export function installPlugin(manifest: DeviceManifest, factory: () => FrameSink): boolean {
  try {
    registerSink(manifest, factory);
    return store.has(manifest.name);
  } catch {
    return false;
  }
}

export function uninstallPlugin(name: string): boolean {
  const had = store.has(name);
  store.delete(name);
  enabled.delete(name);
  return had;
}

export function getMetadata(name: string): DeviceManifest | null {
  return store.get(name)?.manifest ?? null;
}

export function safeCreate(name: string): FrameSink | null {
  const entry = store.get(name);
  if (!entry) return null;
  try {
    return entry.factory();
  } catch {
    return null;
  }
}

export const defaultRegistry = { registerSink, autoDiscover, getAvailableSinks, setEnabled, isEnabled, isVersionCompatible, validateDependencies, installPlugin, uninstallPlugin, getMetadata, safeCreate };

export function parseManifest(raw: unknown): DeviceManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.name !== "string" || typeof o.sink !== "string") return null;
  return o as DeviceManifest;
}

export function loadManifests(manifests: unknown[], factories: Record<string, () => FrameSink>) {
  for (const raw of manifests) {
    const m = parseManifest(raw);
    if (m && factories[m.sink]) registerSink(m, factories[m.sink]!);
  }
}
