import { webcrypto } from "node:crypto";

Object.defineProperty(globalThis, "crypto", {
  value: webcrypto,
  configurable: true,
});

const { build } = await import("vite");

await build();
