// Fails the build if any VITE_*-prefixed secret name appears in source or
// env templates. Vite inlines VITE_* vars into the client bundle, so any
// provider key with that prefix would ship to every visitor.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");

const SCAN_DIRS = ["src", "server", "scripts"];
const SCAN_FILES = [".env", ".env.example", ".env.local", ".env.production"];
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs)$/i;
const SECRET_TOKEN = /\bVITE_[A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL|PASS)\b/g;

const hits = [];

function scanFile(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return;
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const matches = lines[i].match(SECRET_TOKEN);
    if (matches) {
      // Report only the variable name, never the rest of the line (which in
      // an .env file would be a real secret value).
      for (const name of new Set(matches)) {
        hits.push({ path, line: i + 1, name });
      }
    }
  }
}

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist" || entry === ".git") continue;
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) {
      walk(full);
    } else if (CODE_EXT.test(entry)) {
      scanFile(full);
    }
  }
}

for (const d of SCAN_DIRS) walk(join(ROOT, d));
for (const f of SCAN_FILES) scanFile(join(ROOT, f));

if (hits.length > 0) {
  console.error("");
  console.error("env leakage check: FAIL");
  console.error("");
  console.error("Found VITE_*-prefixed secret-shaped variable names. Vite inlines");
  console.error("any VITE_* var into the public client bundle, so these would ship");
  console.error("to every visitor of the site.");
  console.error("");
  for (const h of hits) {
    console.error(`  ${h.path}:${h.line}  ${h.name}`);
  }
  console.error("");
  console.error("Provider keys must be read server-side via process.env without a");
  console.error("VITE_ prefix (see pwa/server/index.mjs and pwa/.env.example).");
  process.exit(1);
}

console.log("env leakage check: ok");
