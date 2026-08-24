# SDK — isVisible Plugin SDK

Re-exports `pwa/src/modules/tactile-output/plugin.ts` + `registry.ts` + `deviceManager.ts` + `devices/*`.

```ts
import { registerSink } from "@/modules/tactile-output/registry";
import type { FrameSink, DeviceManifest } from "@/modules/tactile-output/registry";
import { deviceManager } from "@/modules/tactile-output/deviceManager";
```

See `PLUGIN_GUIDE.md`, `docs/PLUGIN_ARCHITECTURE.md`, `docs/TACTILE_PLUGIN.md`, `ARCHITECTURE.md` for full.
CLI: `node scripts/create-plugin.mjs my-device --cells 8 --dots 8`
Testing: `pwa/src/modules/tactile-output/testing.ts` helpers + `MockDevice`.
