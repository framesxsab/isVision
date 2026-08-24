import type { FrameSink } from "../plugin";
import { registerSink } from "../registry";

export class HIDDevice implements FrameSink {
  name = "hid-braille";
  private device: unknown | null = null;
  private reports: string[] = [];

  async requestDevice(): Promise<unknown | null> {
    if (typeof navigator === "undefined" || !("hid" in navigator)) return null;
    try {
      const hid = (navigator as unknown as { hid: { requestDevice: (opts: unknown) => Promise<unknown[]> } }).hid;
      const devices = await hid.requestDevice({
        filters: [{ usagePage: 0x41 }],
      });
      this.device = (devices[0] as unknown) ?? null;
      if (this.device) {
        this.reports = this.detectReports(this.device);
        const d = this.device as unknown as { opened?: boolean; open?: () => Promise<void> };
        if (!d.opened && d.open) await d.open();
      }
      return this.device;
    } catch {
      return null;
    }
  }

  private detectReports(device: unknown): string[] {
    try {
      const cols = (device as unknown as { collections?: Array<{ outputReports?: unknown[] }> }).collections;
      if (!cols) return [];
      return cols.flatMap((c) => (c.outputReports ?? []).map((_, i) => `report-${i}`));
    } catch {
      return [];
    }
  }

  getReports(): string[] {
    return [...this.reports];
  }

  onFrame(masks: number[], cellStart: number, _index: number) {
    const d = this.device as unknown as { opened?: boolean; sendReport?: (id: number, data: Uint8Array) => Promise<void> } | null;
    if (!d?.opened) return;
    const data = new Uint8Array(masks.map((m) => m & 0xff));
    try {
      void d.sendReport?.(0, data);
    } catch {
      // graceful fallback — no throw, hot-swap will try next sink
    }
    void cellStart;
  }

  onBlank() {
    const d = this.device as unknown as { opened?: boolean; sendReport?: (id: number, data: Uint8Array) => Promise<void> } | null;
    if (!d?.opened) return;
    try {
      void d.sendReport?.(0, new Uint8Array(0));
    } catch {
      // fallback
    }
  }
}

registerSink(
  { name: "hid-braille", version: "0.1.0", sink: "hid-braille", capabilities: ["hid-braille"], cells: 40, dots: 8, requires: ["WebHID"] },
  () => new HIDDevice()
);
