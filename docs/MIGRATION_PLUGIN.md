# Migration — Hardcoded Sink → DeviceManager (zero breaking changes)

> On `v0.2.0-prep` (e786794). PWA side only. Python `tactile_serve.py` and `protocol.py` unchanged.

## Before

```ts
// old — hardcoded
if (spec === "brltty") sink = new BrlttySink();
else if (spec.startsWith("serial:")) sink = new SerialSink(port);
```

`plugin.ts:createLoggingSink()` was the only `FrameSink` helper.

## After (additive)

```ts
import { registry } from "@/modules/tactile-output/registry";
import { DeviceManager } from "@/modules/tactile-output/deviceManager";

const manager = new DeviceManager(registry);
const available = manager.list(); // auto-discovery via navigator.serial/hid
await manager.connect("mock"); // DI, no switch
manager.setSink(otherSink); // hot-swap without reload
```

Old path still works — `registry` registers built-ins (`log`, `mock`, `virtual`, `brltty-relay`) at import, `build_sink(spec)` fallback remains until `v0.3.0`. New code uses manager; old code not deleted.

## Steps for contributors

1. Add new device: create `myDevice.ts` implementing `FrameSink`, add `manifest.json` (`name`, `cells`, `capabilities`), call `registerSink(manifest, factory)`.
2. Test via `MockDevice` + `HardwareEmulatorPage` or `/device-diagnostics` hot-swap, no hardware needed.
3. Verify: `npm run build && npm test` — zero breaking changes: existing 212 vitest + 32 python still green.

## Rollback

If manager misbehaves, import old `plugin.ts` directly — no deletion. Tag `v0.1.0` remains canonical.
