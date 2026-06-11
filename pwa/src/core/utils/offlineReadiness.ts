// "Offline readiness" check: probes the Cache Storage API for the artifacts
// the PWA needs to keep working without a network. We don't try to predict
// whether a hypothetical disconnect will succeed — we just report what's
// actually sitting in the caches right now, and the Settings panel renders
// it as a checklist.
//
// caches.match(url) scans every cache the page has access to, so we don't
// have to know the workbox-generated precache name or the runtime cache
// name (`liblouis-assets-v1`). One probe per asset, no enumeration of
// keys() — that's deliberately cheap.

import type { LiblouisTableId } from "@/modules/tactile-output/liblouisAdapter";

export type Status = "cached" | "missing" | "unknown";

export interface ReadinessReport {
  appShell: Status;
  liblouisRuntime: Status;
  tables: Partial<Record<LiblouisTableId, Status>>;
  checkedAt: number;
  /** True when the Cache Storage API itself is missing (no SW context). */
  cacheApiAvailable: boolean;
}

const tableUrl = (file: string) => `/tables/${file}`;

// Full recursive dependency closure for each exposed Liblouis table chain.
// EasyApiAsync loads includes lazily from the worker; an entry table alone is
// not enough for reliable offline translation after a reload.
export const LIBLOUIS_TABLE_DEPENDENCIES: Record<LiblouisTableId, readonly string[]> = {
  "en-g2": [
    "unicode.dis",
    "en-ueb-g2.ctb",
    "en-ueb-g1.ctb",
    "en-ueb-chardefs.uti",
    "latinLetterDef8Dots.uti",
    "en-ueb-math.ctb",
    "braille-patterns.cti",
  ].map(tableUrl),
  "en-g1": [
    "unicode.dis",
    "en-ueb-g1.ctb",
    "en-ueb-chardefs.uti",
    "latinLetterDef8Dots.uti",
    "en-ueb-math.ctb",
    "braille-patterns.cti",
  ].map(tableUrl),
  "fr-g2": [
    "unicode.dis",
    "fr-bfu-g2.ctb",
    "fr-bfu-comp6.utb",
    "digits6DotsPlusDot6.uti",
    "latinLetterDef6Dots.uti",
    "braille-patterns.cti",
    "fr-bfu-comp68.cti",
  ].map(tableUrl),
  "de-g2": [
    "unicode.dis",
    "de-de-g2.ctb",
    "de-de-g0.utb",
    "de-eurobrl6.dis",
    "de-chardefs6.cti",
    "digits6DotsPlusDot6.uti",
    "latinLetterDef6Dots.uti",
    "de-de-accents.cti",
    "de-g0-core.uti",
    "countries.cti",
    "litdigits6Dots.uti",
    "de-g2-core.cti",
  ].map(tableUrl),
};

export const LIBLOUIS_RUNTIME_URLS = [
  "/liblouis/easy-api.js",
  "/liblouis/build-no-tables-utf16.js",
];

// Bare `caches` doesn't resolve reliably under test stubs in some
// environments, so we always go through globalThis. Function form lets
// callers (and tests) inject a different cache surface if they need to.
function getCaches(): CacheStorage | undefined {
  return (globalThis as { caches?: CacheStorage }).caches;
}

async function isCached(url: string): Promise<boolean> {
  const api = getCaches();
  if (!api) return false;
  try {
    const hit = await api.match(url, { ignoreSearch: true });
    return Boolean(hit);
  } catch {
    return false;
  }
}

async function probeAll(urls: readonly string[]): Promise<Status> {
  if (!getCaches()) return "unknown";
  const results = await Promise.all(urls.map(isCached));
  if (results.every((r) => r)) return "cached";
  if (results.every((r) => !r)) return "missing";
  // Partial — surface that distinctly so the user knows a piece is missing
  // even though something is there.
  return "missing";
}

// Workbox precaches the app shell under a generated name like
// "workbox-precache-v2-...". The exact URL keys it uses are hashed
// (e.g. /assets/index-AbC123.js), so probing "/" directly won't match.
// We instead check whether *any* workbox precache exists with at least
// one entry — that's the right "shell is ready" signal.
export async function checkAppShell(): Promise<Status> {
  const api = getCaches();
  if (!api) return "unknown";
  try {
    const names = await api.keys();
    const precacheNames = names.filter((name) => name.toLowerCase().includes("precache"));
    if (precacheNames.length === 0) return "missing";
    for (const name of precacheNames) {
      const cache = await api.open(name);
      const keys = await cache.keys();
      if (keys.length > 0) return "cached";
    }
    return "missing";
  } catch {
    return "unknown";
  }
}

export async function checkLiblouisRuntime(): Promise<Status> {
  return probeAll(LIBLOUIS_RUNTIME_URLS);
}

export async function checkTable(lang: LiblouisTableId): Promise<Status> {
  if (!getCaches()) return "unknown";
  return probeAll(LIBLOUIS_TABLE_DEPENDENCIES[lang]);
}

export async function checkReadiness(
  languages: readonly LiblouisTableId[] = ["en-g2", "fr-g2", "de-g2"]
): Promise<ReadinessReport> {
  const cacheApiAvailable = Boolean(getCaches());

  const [appShell, liblouisRuntime, tableResults] = await Promise.all([
    checkAppShell(),
    checkLiblouisRuntime(),
    Promise.all(languages.map(async (lang) => [lang, await checkTable(lang)] as const)),
  ]);

  const tables: Partial<Record<LiblouisTableId, Status>> = {};
  for (const [lang, status] of tableResults) {
    tables[lang] = status;
  }

  return {
    appShell,
    liblouisRuntime,
    tables,
    checkedAt: Date.now(),
    cacheApiAvailable,
  };
}

// Human-readable labels for the language ids — the Settings panel needs them
// next to each row, and keeping the mapping next to the rest of the
// readiness code beats threading the strings through props.
export const LANGUAGE_LABELS: Record<LiblouisTableId, string> = {
  "en-g2": "English UEB",
  "en-g1": "English UEB (Grade 1)",
  "fr-g2": "Français",
  "de-g2": "Deutsch",
};
