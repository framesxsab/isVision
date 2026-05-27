// Copies the liblouis WASM build, easy-api shim, and the table set we need
// for English UEB Grade 2 from node_modules into public/ so Vite serves them
// at well-known URLs. The async EasyApi spins up a Worker that importScripts()
// these paths; tables are pulled lazily by createLazyFile.
//
// public/liblouis/ and public/tables/ are .gitignored — this script must run
// in prebuild / predev to materialize them.

import { copyFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pwaRoot = join(here, "..");
const nodeModules = join(pwaRoot, "node_modules");

// Tables we ship into public/tables/. The Liblouis Worker loads these lazily
// on first translation, so adding more tables doesn't grow the install-time
// precache. Each entry was traced through `include` directives recursively so
// the dependency closure is complete for the languages we expose.
const TABLES = [
  // Shared base files used by every language we ship.
  "unicode.dis",
  "braille-patterns.cti",
  "latinLetterDef8Dots.uti",
  "latinLetterDef6Dots.uti",
  "digits6DotsPlusDot6.uti",
  "litdigits6Dots.uti",
  "litdigits6DotsPlusDot6.uti",
  "countries.cti",
  "text_nabcc.dis",

  // English UEB (Grade 1 + Grade 2 + math + chardefs).
  "en-ueb-g2.ctb",
  "en-ueb-g1.ctb",
  "en-ueb-chardefs.uti",
  "en-ueb-math.ctb",

  // French (Braille français unifié) Grade 2 and its dependency chain.
  "fr-bfu-g2.ctb",
  "fr-bfu-comp6.utb",
  "fr-bfu-comp68.cti",

  // German (Kurzschrift) Grade 2 and its dependency chain.
  "de-de-g2.ctb",
  "de-de-g1.ctb",
  "de-de-g0.utb",
  "de-de-accents.cti",
  "de-chardefs6.cti",
  "de-g0-core.uti",
  "de-g1-core.cti",
  "de-g2-core.cti",
  "de-eurobrl6.dis",
];

const LIB_FILES = [
  ["liblouis/easy-api.js", "liblouis/easy-api.js"],
  ["liblouis-build/build-no-tables-utf16.js", "liblouis/build-no-tables-utf16.js"],
];

const liblouisOut = join(pwaRoot, "public", "liblouis");
const tablesOut = join(pwaRoot, "public", "tables");

if (existsSync(liblouisOut)) rmSync(liblouisOut, { recursive: true, force: true });
if (existsSync(tablesOut)) rmSync(tablesOut, { recursive: true, force: true });

mkdirSync(liblouisOut, { recursive: true });
mkdirSync(tablesOut, { recursive: true });

for (const [src, dest] of LIB_FILES) {
  copyFileSync(join(nodeModules, src), join(pwaRoot, "public", dest));
}

for (const table of TABLES) {
  copyFileSync(
    join(nodeModules, "liblouis-build", "tables", table),
    join(tablesOut, table)
  );
}

const total = LIB_FILES.length + TABLES.length;
console.log(`Copied ${total} Liblouis assets into public/`);
