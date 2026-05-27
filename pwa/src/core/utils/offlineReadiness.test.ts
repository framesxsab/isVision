import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIBLOUIS_RUNTIME_URLS,
  checkAppShell,
  checkLiblouisRuntime,
  checkReadiness,
  checkTable,
} from "./offlineReadiness";

// We stub the Cache Storage API with two layers:
//   1. A virtual cache name map → set of URL keys (for caches.keys() and
//      open(name).keys() which the app-shell probe uses).
//   2. A flat URL set for caches.match() which the runtime/table probes use.
// Real CacheStorage scans every named cache; for our assertion surface,
// these two layers are equivalent to the real semantics.
function installCacheStub(
  initial: Iterable<string> = [],
  named: Record<string, string[]> = {}
) {
  const stored = new Set<string>(initial);
  const cacheMap = new Map<string, string[]>(Object.entries(named));
  const stub = {
    async match(input: RequestInfo | URL): Promise<Response | undefined> {
      const url = typeof input === "string" ? input : (input as URL).toString();
      const path = url.split("?")[0]!;
      return stored.has(path) ? new Response("", { status: 200 }) : undefined;
    },
    async keys(): Promise<string[]> {
      return Array.from(cacheMap.keys());
    },
    async open(name: string) {
      const entries = cacheMap.get(name) ?? [];
      return {
        // The real Cache.keys() returns Request[]; we only need to count
        // entries, so plain placeholders avoid `new Request("/path")`
        // which throws on bare paths in Node without a document base.
        async keys() {
          return entries.map(() => ({}));
        },
      };
    },
  };
  vi.stubGlobal("caches", stub);
  return {
    add: (url: string) => stored.add(url),
    remove: (url: string) => stored.delete(url),
    addNamed: (cache: string, urls: string[]) => cacheMap.set(cache, urls),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("checkAppShell", () => {
  it("returns 'cached' when a workbox precache has at least one entry", async () => {
    installCacheStub([], {
      "workbox-precache-v2-https://localhost:4173/": [
        "/index.html",
        "/assets/index-AbC123.js",
      ],
    });
    expect(await checkAppShell()).toBe("cached");
  });

  it("returns 'missing' when no precache exists yet", async () => {
    installCacheStub([], { "liblouis-assets-v1": ["/tables/en-ueb-g2.ctb"] });
    expect(await checkAppShell()).toBe("missing");
  });

  it("returns 'missing' when the precache name exists but is empty", async () => {
    installCacheStub([], { "workbox-precache-v2": [] });
    expect(await checkAppShell()).toBe("missing");
  });

  it("returns 'unknown' when the Cache Storage API itself is missing", async () => {
    expect(await checkAppShell()).toBe("unknown");
  });
});

describe("checkLiblouisRuntime", () => {
  it("requires both runtime files to be cached", async () => {
    const cache = installCacheStub(LIBLOUIS_RUNTIME_URLS);
    expect(await checkLiblouisRuntime()).toBe("cached");

    cache.remove("/liblouis/build-no-tables-utf16.js");
    expect(await checkLiblouisRuntime()).toBe("missing");
  });
});

describe("checkTable", () => {
  it("reports cached when the entry table exists for that language", async () => {
    installCacheStub(["/tables/fr-bfu-g2.ctb"]);
    expect(await checkTable("fr-g2")).toBe("cached");
    expect(await checkTable("de-g2")).toBe("missing");
  });

  it("reports unknown when the Cache API is unavailable", async () => {
    // No installCacheStub call → caches global doesn't exist
    expect(await checkTable("en-g2")).toBe("unknown");
  });
});

describe("checkReadiness", () => {
  beforeEach(() => {
    installCacheStub(
      [...LIBLOUIS_RUNTIME_URLS, "/tables/en-ueb-g2.ctb", "/tables/fr-bfu-g2.ctb"],
      { "workbox-precache-v2": ["/index.html"] }
    );
  });

  it("rolls up a complete report including a timestamp", async () => {
    const report = await checkReadiness(["en-g2", "fr-g2", "de-g2"]);
    expect(report.appShell).toBe("cached");
    expect(report.liblouisRuntime).toBe("cached");
    expect(report.tables).toEqual({
      "en-g2": "cached",
      "fr-g2": "cached",
      "de-g2": "missing",
    });
    expect(report.cacheApiAvailable).toBe(true);
    expect(typeof report.checkedAt).toBe("number");
    expect(report.checkedAt).toBeLessThanOrEqual(Date.now());
  });

  it("defaults to checking the three languages we expose", async () => {
    const report = await checkReadiness();
    expect(Object.keys(report.tables).sort()).toEqual(["de-g2", "en-g2", "fr-g2"]);
  });
});
