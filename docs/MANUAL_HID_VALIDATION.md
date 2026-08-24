# Manual HID Validation — isVisible (NOT YET VERIFIED)

> **Status: MANUAL / NOT YET VERIFIED** — No physical Braille HID device has been connected in this release. Software validation via MockDevice/VirtualDevice is green; physical validation remains.

## Software validation (done, additive)

- `hidDevice.test.ts`: HID unavailable fallback, auto-detect empty, hot-swap Mock→Virtual, permission no-throw — 4 tests green
- `registry.marketplace.test.ts`: dependency validation for WebHID missing → unavailable
- `DeviceDiagnosticsPage`: enable/disable toggle, hot-swap without reload

## Manual checklist (when real Braille device available)

1. **Capability detection:** Connect Braille display via USB, open `chrome://device-log`, verify `navigator.hid.requestDevice({filters:[{usagePage:0x41}]})` lists device, `HIDDevice.getReports()` returns outputReports
2. **Permission denied:** Deny HID permission, verify diagnostics shows `WebHID not supported` or `disabled`, fallback to Mock without throw
3. **Unsupported browser:** Open in Firefox/Safari, verify `HIDDevice.requestDevice()` returns null, `available:false`
4. **Connect/hot-swap:** In `/device-diagnostics`, Connect hid-braille → send `F 0 0 1` → verify pins actuate; Hot-swap to mock → verify no reload, announce `Hot-swapped`
5. **Disconnect:** Verify `device.close()` on disconnect, hot-swap back

Do not claim physical validation until steps 1-5 are run with a real device and logged to `docs/reports/hid-braille-manual.md` (not yet exists).

See `HARDWARE.md` for safety constraints.
