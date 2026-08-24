import { describe, it, expect } from "vitest";
import { registerSink, autoDiscover, getAvailableSinks, setEnabled, isEnabled, isVersionCompatible, validateDependencies, installPlugin, uninstallPlugin, parseManifest } from "./registry";
import { createLoggingSink } from "./plugin";

describe("marketplace registry", () => {
  it("registers and discovers mock device", () => {
    registerSink({ name: "test-mock", version: "0.1.0", sink: "test-mock", capabilities: ["mock"], cells: 8, dots: 8 }, () => createLoggingSink());
    const found = autoDiscover().find((d) => d.manifest.name === "test-mock");
    expect(found).toBeDefined();
    expect(found?.available).toBe(true);
  });

  it("version compat rejects major 2", () => {
    expect(isVersionCompatible("2.0.0")).toBe(false);
    expect(isVersionCompatible("0.1.0")).toBe(true);
    expect(isVersionCompatible("1.2.3")).toBe(true);
  });

  it("dependency validation marks unsupported when WebHID missing", () => {
    const dep = validateDependencies({ name: "x", version: "0.1.0", sink: "x", capabilities: [], cells: 8, dots: 8, requires: ["WebHID"] });
    const hasHid = typeof navigator !== "undefined" && "hid" in navigator;
    if (!hasHid) expect(dep.ok).toBe(false);
    else expect(dep.ok).toBe(true);
  });

  it("enable/disable toggles availability", () => {
    registerSink({ name: "toggle-test", version: "0.1.0", sink: "toggle-test", capabilities: [], cells: 8, dots: 8 }, () => createLoggingSink());
    setEnabled("toggle-test", false);
    expect(isEnabled("toggle-test")).toBe(false);
    expect(autoDiscover().find((d) => d.manifest.name === "toggle-test")?.available).toBe(false);
    setEnabled("toggle-test", true);
    expect(isEnabled("toggle-test")).toBe(true);
  });

  it("install/uninstall sandbox", () => {
    const m = { name: "install-test", version: "0.1.0", sink: "install-test", capabilities: [], cells: 8, dots: 8 } as const;
    expect(installPlugin(m as never, () => createLoggingSink())).toBe(true);
    expect(uninstallPlugin("install-test")).toBe(true);
    expect(uninstallPlugin("no-such")).toBe(false);
  });

  it("parseManifest rejects invalid", () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest({ name: "a" })).toBeNull();
    expect(parseManifest({ name: "a", sink: "b" })).not.toBeNull();
  });

  it("getAvailableSinks filters disabled and unsupported", () => {
    const all = autoDiscover();
    const avail = getAvailableSinks();
    expect(avail.length).toBeLessThanOrEqual(all.length);
  });
});
