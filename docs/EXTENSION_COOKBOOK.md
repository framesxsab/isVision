# Extension Cookbook — isVisible

- **Serial device:** copy `exampleSerialDevice.ts`, change `requires: ["WebSerial"]`, `cells/dots`, factory
- **Bluetooth device:** copy `exampleBluetoothDevice.ts`, `requires: ["WebBluetooth"]`
- **HID device:** `requires: ["WebHID"]`, handle `hid.requestDevice`
- **Test:** `MockDevice` + `withMockDevice` in `testing.ts`, then `/device-diagnostics` hot-swap
- **Ship:** `node scripts/create-plugin.mjs my-device --cells 4 --dots 6`

See `PLUGIN_GUIDE.md` + `TACTILE_PLUGIN.md`.
