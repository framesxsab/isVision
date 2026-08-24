import type { FrameSink } from "./plugin";
import { defaultRegistry } from "./registry";
import type { DeviceDescriptor } from "./registry";
import "./devices/mockDevice";
import "./devices/virtualDevice";
import "./devices/brlttyRelay";

export class DeviceManager {
  private current: FrameSink | null = null;
  private currentName: string | null = null;

  constructor(private registry = defaultRegistry) {}

  list(): DeviceDescriptor[] {
    return this.registry.autoDiscover();
  }

  available(): DeviceDescriptor[] {
    return this.registry.getAvailableSinks();
  }

  async connect(name: string): Promise<FrameSink> {
    const entry = this.registry.autoDiscover().find((d) => d.manifest.name === name);
    if (!entry) throw new Error(`Device not found: ${name}`);
    if (!entry.available) throw new Error(`Device not available: ${entry.reason}`);
    const sink = entry.factory();
    this.current = sink;
    this.currentName = name;
    return sink;
  }

  disconnect() {
    this.current = null;
    this.currentName = null;
  }

  setSink(sink: FrameSink) {
    this.current = sink;
    this.currentName = sink.name;
    sink.onConfig?.({ holdMs: 900, blankBetweenFrames: true });
  }

  getCurrent(): FrameSink | null {
    return this.current;
  }

  getCurrentName(): string | null {
    return this.currentName;
  }

  diagnostics() {
    return {
      current: this.currentName,
      available: this.available().map((d) => d.manifest.name),
      all: this.list().map((d) => ({ name: d.manifest.name, available: d.available, reason: d.reason })),
    };
  }
}

export const deviceManager = new DeviceManager();
