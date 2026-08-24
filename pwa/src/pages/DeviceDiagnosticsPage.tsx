import { useState, useCallback } from "react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/Button";
import { deviceManager } from "@/modules/tactile-output/deviceManager";
import { useAnnounce } from "@/core/a11y/AriaLive";

export default function DeviceDiagnosticsPage() {
  const [current, setCurrent] = useState<string | null>(deviceManager.getCurrentName());
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const announce = useAnnounce();

  const devices = deviceManager.list();

  const handleConnect = useCallback(async (name: string) => {
    setError(null);
    try {
      await deviceManager.connect(name);
      setCurrent(name);
      const msg = `Connected to ${name}`;
      setMessages((m) => [...m, msg]);
      announce(msg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connect failed";
      setError(msg);
      announce(msg, "assertive");
    }
  }, [announce]);

  const handleDisconnect = useCallback(() => {
    deviceManager.disconnect();
    setCurrent(null);
    const msg = "Disconnected";
    setMessages((m) => [...m, msg]);
    announce(msg);
  }, [announce]);

  const handleHotSwap = useCallback(async (name: string) => {
    setError(null);
    try {
      const sink = await deviceManager.connect(name);
      deviceManager.setSink(sink);
      setCurrent(name);
      const msg = `Hot-swapped to ${name} without reload`;
      setMessages((m) => [...m, msg]);
      announce(msg);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Hot-swap failed";
      setError(msg);
      announce(msg, "assertive");
    }
  }, [announce]);

  return (
    <PageShell title="Device Diagnostics" accent="emerald">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <section aria-labelledby="devices-heading" className="surface-panel border border-surface-border rounded-2xl p-5">
          <h2 id="devices-heading" className="text-lg font-semibold text-stone-50">Available devices</h2>
          <p className="text-sm text-stone-400 mt-1">Auto-discovered via runtime capability detection. Hot-swap does not reload the page.</p>
          {devices.length === 0 ? (
            <p className="text-sm text-stone-500 mt-4" role="status">No devices registered. Import a sink to register.</p>
          ) : (
            <ul className="mt-4 space-y-2" aria-label="Device list">
              {devices.map((d) => (
                <li key={d.manifest.name} className="flex items-center justify-between gap-3 surface-card border border-surface-border rounded-xl p-3">
                  <div>
                    <span className="text-stone-50 font-medium">{d.manifest.name}</span>
                    <span className={`ml-2 text-xs px-2 py-0.5 rounded-full border ${d.available ? "text-emerald-300 border-emerald-400/30 bg-emerald-500/10" : "text-amber-300 border-amber-400/30 bg-amber-500/10"}`}>
                      {d.available ? "Available" : d.reason}
                    </span>
                    <p className="text-xs text-stone-500 mt-1">{d.manifest.cells} cells, {d.manifest.dots}-dot, {d.manifest.capabilities.join(", ")}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => handleConnect(d.manifest.name)} disabled={!d.available} aria-label={`Connect to ${d.manifest.name}`}>
                      Connect
                    </Button>
                    <Button variant="ghost" onClick={() => handleHotSwap(d.manifest.name)} disabled={!d.available} aria-label={`Hot-swap to ${d.manifest.name}`}>
                      Hot-swap
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex gap-2">
            <Button variant="ghost" onClick={handleDisconnect} disabled={!current} aria-label="Disconnect current device">Disconnect</Button>
            <span className="text-sm text-stone-400 py-3" role="status" aria-live="polite">Current: {current ?? "none"}</span>
          </div>
          {error && <p className="text-sm text-rose-300 mt-3" role="alert">{error}</p>}
        </section>

        <section aria-labelledby="transcript-heading" className="surface-panel border border-surface-border rounded-2xl p-5">
          <h2 id="transcript-heading" className="text-lg font-semibold text-stone-50">Transcript</h2>
          {messages.length === 0 ? (
            <p className="text-sm text-stone-500 mt-2">No actions yet. Connect a device to see live announcements.</p>
          ) : (
            <ol className="mt-2 space-y-1" aria-label="Transcript">
              {messages.map((m, i) => <li key={i} className="text-sm text-stone-300">{m}</li>)}
            </ol>
          )}
          <div aria-live="polite" aria-atomic="true" className="sr-only">{messages[messages.length - 1] ?? ""}</div>
        </section>

        <section aria-labelledby="diag-heading" className="surface-panel border border-surface-border rounded-2xl p-5">
          <h2 id="diag-heading" className="text-lg font-semibold text-stone-50">Diagnostics</h2>
          <pre className="text-xs text-stone-400 mt-2 overflow-auto">{JSON.stringify(deviceManager.diagnostics(), null, 2)}</pre>
        </section>
      </div>
    </PageShell>
  );
}
