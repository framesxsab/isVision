#!/usr/bin/env node
// One-command setup — new contributor productive in 5 minutes.
import { execSync } from "node:child_process";
const run = (cmd, cwd = ".") => execSync(cmd, { stdio: "inherit", cwd });
console.log("→ pwa deps");
run("npm ci", "pwa");
console.log("→ verify (build + tests)");
run("npm run build", "pwa");
run("npm test", "pwa");
console.log("→ python bridge tests");
run("python -m unittest discover -s tests", ".");
console.log("✓ setup complete — cd pwa && npm run dev");
