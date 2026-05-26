// Async adapter around the liblouis Easy-API (async/worker variant).
//
// Loading strategy:
//   1. /liblouis/easy-api.js is injected as a <script> on first use. The UMD's
//      browser-globals branch fires (because Vite isn't bundling it), exposing
//      window.LiblouisEasyApiAsync.
//   2. We instantiate EasyApiAsync, which spins up a Worker that importScripts()
//      build-no-tables-utf16.js + easy-api.js. The Worker fetches table files
//      lazily over XHR (sync XHR is allowed inside Workers).
//   3. We translate via translateString("unicode.dis,en-ueb-g2.ctb", text), then
//      convert the returned U+2800-block braille string back to BrailleCell[]
//      so the rest of the pipeline (frame builder, serializer, UI) is unchanged.
//
// The WASM build is large (~1.6 MB); this adapter is dynamically imported from
// TactileOutputPage so the cost only lands when the user opts into Grade 2.

import { createCell, type BrailleCell } from "./brailleFrames";

const SCRIPT_URL = "/liblouis/easy-api.js";
const CAPI_URL = "liblouis/build-no-tables-utf16.js";
const EASYAPI_URL = "liblouis/easy-api.js";
const TABLES_URL = "tables/";
const GRADE_2_TABLE = "unicode.dis,en-ueb-g2.ctb";

const INIT_TIMEOUT_MS = 15_000;
const TRANSLATE_TIMEOUT_MS = 8_000;

interface LiblouisAsyncApi {
  enableOnDemandTableLoading(url: string): void;
  translateString(table: string, text: string, cb: (result: string) => void): void;
  version(cb: (v: string) => void): void;
}

type LiblouisCtor = new (opts: { capi: string; easyapi: string }) => LiblouisAsyncApi;

declare global {
  interface Window {
    LiblouisEasyApiAsync?: LiblouisCtor;
  }
}

let apiPromise: Promise<LiblouisAsyncApi> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing && existing.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
      return;
    }
    const tag = document.createElement("script");
    tag.src = src;
    tag.async = true;
    tag.addEventListener(
      "load",
      () => {
        tag.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    tag.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)), { once: true });
    document.head.appendChild(tag);
  });
}

async function getApi(): Promise<LiblouisAsyncApi> {
  if (apiPromise) return apiPromise;

  apiPromise = (async () => {
    await loadScript(SCRIPT_URL);

    const Ctor = window.LiblouisEasyApiAsync;
    if (!Ctor) {
      throw new Error("Liblouis Easy-API script loaded but EasyApiAsync is missing.");
    }

    const api = new Ctor({ capi: CAPI_URL, easyapi: EASYAPI_URL });
    api.enableOnDemandTableLoading(TABLES_URL);

    // version() is the cheapest call that proves the worker is healthy and
    // the WASM build registered itself. If the worker can't load the build,
    // we surface that here instead of mid-translation.
    await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Liblouis init timed out.")), INIT_TIMEOUT_MS);
      api.version((v) => {
        clearTimeout(timer);
        if (typeof v === "string" && v.length > 0) {
          resolve(v);
        } else {
          reject(new Error("Liblouis version() returned an empty response."));
        }
      });
    });

    return api;
  })().catch((err) => {
    // Reset so a transient failure (network blip) doesn't poison future calls.
    apiPromise = null;
    throw err;
  });

  return apiPromise;
}

export async function translateGrade2(text: string): Promise<BrailleCell[]> {
  if (text.length === 0) return [];

  const api = await getApi();
  const braille: string = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Liblouis translate timed out.")), TRANSLATE_TIMEOUT_MS);
    api.translateString(GRADE_2_TABLE, text, (result) => {
      clearTimeout(timer);
      if (typeof result === "string") {
        resolve(result);
      } else {
        reject(new Error("Liblouis returned a non-string translation."));
      }
    });
  });

  return brailleStringToCells(braille);
}

// Exposed for unit tests so the U+2800 → BrailleCell decoder can be exercised
// without spinning up a real Worker.
export function brailleStringToCells(braille: string): BrailleCell[] {
  return Array.from(braille).map((char) => {
    const code = char.codePointAt(0) ?? 0;
    const isBrailleBlock = code >= 0x2800 && code <= 0x28ff;
    const mask = isBrailleBlock ? code - 0x2800 : 0;
    if (char === " ") {
      return createCell(0, " ", "space");
    }
    if (!isBrailleBlock) {
      return createCell(0, char, "unknown");
    }
    return createCell(mask, char, "content");
  });
}

// Test seam: lets tests reset the cached worker handle between cases.
export function __resetLiblouisAdapterForTests() {
  apiPromise = null;
}
