# Plugin Architecture — isVisible (plug-and-play, zero breaking changes)

> Additive only. Existing `FrameSink` (`pwa/src/modules/tactile-output/plugin.ts:1-6`), `tactile_serve.py:58-72` `Sink`, and compact v1 (`src/isvisible/protocol.py`) remain canonical. New code wraps them, not rewrites.

## Goal

Hot-swap devices without reload, auto-discover sinks, inject capabilities — PWA → bridge → firmware stays honest (BRLTTY is relay).

## Core

### 1) FrameSink (existing, preserved)

`pwa/src/modules/tactile-output/plugin.ts`
```ts
export interface FrameSink { name: string; onConfig?(c:{holdMs:number;blankBetweenFrames:boolean}):void; onFrame(masks:number[],cellStart:number,index:number):void; onBlank?():void }
```
Python mirror `tools/tactile_serve.py:58` `Sink` Protocol (`open/on_config/on_frame/on_blank/close`). **Zero breaking changes** — old `createLoggingSink()` still works.

### 2) Manifest schema (new)

`pwa/src/modules/tactile-output/manifest.schema.json` (additive):
```json
{ "name":"my-display","version":"0.1.0","sink":"mySink","capabilities":["serial","hid","bluetooth"],"cells":40,"dots":8,"requires":["WebHID"] }
```
Validated via `plugin.ts` `parseManifest()` (Zod-like tiny validator). Unknown keys tolerated for forward compat (like `CFG` unknown keys).

### 3) Registry with auto-discovery

`pwa/src/modules/tactile-output/registry.ts`
- `registerSink(manifest, factory: () => FrameSink)` — static registration (tree-shakable).
- `autoDiscover(): DeviceDescriptor[]` — runtime capability detection: `navigator.serial`, `navigator.hid`, `navigator.bluetooth` probes (feature-detect, never throws). Returns `available: boolean` + `reason`.
- `getAvailableSinks()` — filters `available`, used by `DeviceManager`.
- Add new sink by creating file and calling `registerSink` at import — no hardcoded `switch` in manager.

### 4) DeviceManager (DI, hot-swap)

`pwa/src/modules/tactile-output/deviceManager.ts`
```ts
class DeviceManager {
  constructor(private registry = defaultRegistry) {}
  list(): DeviceDescriptor[] { return this.registry.getAvailableSinks(); }
  async connect(name: string): Promise<FrameSink> // DI: factory injected, no hardcode
  disconnect(): void
  setSink(sink: FrameSink): void // hot-swap without reload — swaps `current` and calls onConfig for holdMs
  onDiagnostics(): CapabilityReport // runtime `detectCapability()` from pwa/src/core/utils/capabilities.ts
}
```
DI: `DeviceManager` takes registry/factory, not `if (spec==="brltty")`. Existing `tactile_serve.py build_sink(spec)` stays for Python; PWA side now uses manager.

### 5) Adapters (additive)

- `MockDevice` — in-memory sink for tests and Storybook, records `onFrame` calls, no hardware.
- `VirtualDevice` — renders frames to `HardwareEmulatorPage` canvas without serial, hot-swappable.
- `BRLTTYRelay` — wraps `BrlttySink` semantics (relay to running daemon via `writeDots`), honest name — not a driver. Requires `brlapi` lazy, shows `needs-triage` if unavailable.

All implement `FrameSink`, registered via manifest.

### 6) Runtime capability detection

Reuses `pwa/src/core/utils/capabilities.ts:detectCapability()` + `queryMediaPermission`. `DeviceManager.onDiagnostics()` merges `registry` availability with OS permissions (camera/mic/serial/hid). Diagnostics page consumes it live.

### 7) Diagnostics + hot-swap UI

`/device-diagnostics` (new route, additive, `PageShell` + `AriaLive` + `LiveRegion` transcript):
- Lists `DeviceManager.list()` with `available/needs fallback` chips (color + text, not color alone).
- Buttons `Connect` / `Disconnect` / `Hot-swap` (change `current` sink, no reload, `announce("Switched to …")`).
- Shows `holdMs`, `blank`, protocol `CFG` line, last `F` masks as Unicode `U+2800`.

## Migration notes

- **PWA call sites:** replace `if (out==="brltty") new BrlttySink()` with `deviceManager.connect(name)` — old `plugin.ts:createLoggingSink` still works, new code imports `registry`.
- **Python:** `tactile_serve.py` unchanged; PWA now exports compact via `serial:` spec that `SerialSink` relays. No breaking change to wire format (`CFG/F/B/END/IN`).
- **Tests:** `MockDevice` records frames — existing `brailleFrames.test.ts` etc. unchanged; new `registry.test.ts`, `deviceManager.test.ts`, `diagnostics.test.ts` cover auto-discovery and hot-swap.
- **Zero reload:** hot-swap swaps `current` reference; `holdMs` reconfig via `onConfig` without remount.

## Why additive

Preserves `App.tsx` routes, `protocol.py` grammar, history (`v0.1.0` tag). New `registry`/`manager`/adapters are new files, not rewrites. Old hardcoded selection path remains as fallback until removed in `v0.3.0` (deprecation note, not deletion).

See `docs/TACTILE_PLUGIN.md` for existing sink tutorial, `HARDWARE.md` for safety, `ACCESSIBILITY.md` for live-region/focus guarantees on diagnostics page.
