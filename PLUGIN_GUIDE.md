# Plugin Guide — isVisible

See `docs/PLUGIN_ARCHITECTURE.md` + `SDK.md` + `ARCHITECTURE.md`.

1. `node scripts/create-plugin.mjs my-device` — scaffold `pwa/src/modules/tactile-output/devices/myDevice.ts` + manifest
2. Implement `FrameSink` (`name`, `onFrame`, `onConfig`, `onBlank`)
3. `registerSink(manifest, factory)` — auto-discovered, no hardcoded switch
4. Test via `MockDevice` + `HardwareEmulatorPage` or `/device-diagnostics` hot-swap (no hardware)
5. `npm run build && npm test` — zero breaking changes required

Examples: `exampleSerialDevice.ts` (WebSerial), `exampleBluetoothDevice.ts` (WebBluetooth) — additive, not bundled by default.
