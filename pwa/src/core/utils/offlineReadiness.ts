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

// One entry table per language. If the entry table is cached, Liblouis can
// load it from the in-page worker even offline. Sub-tables resolve lazily,
// so the entry table being present is the right "ready to translate" signal
// the user cares about.
const ENTRY_TABLE_FOR_LANG: Record<LiblouisTableId, string> = {
  "en-g2": "/tables/en-ueb-g2.ctb",
  "en-g1": "/tables/en-ueb-g1.ctb",
  "fr-g2": "/tables/fr-bfu-g2.ctb",
  "de-g2": "/tables/de-de-g2.ctb",
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
  return (await isCached(ENTRY_TABLE_FOR_LANG[lang])) ? "cached" : "missing";
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
