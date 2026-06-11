import { spawn } from "node:child_process";

const viteArgs = normalizeViteArgs(process.argv.slice(2));
const viteBin = "node_modules/vite/bin/vite.js";

function normalizeViteArgs(args) {
  if (args.length === 0) return ["--host", "127.0.0.1", "--port", "5173"];
  // npm may consume known-looking flags on Windows and leave only values.
  if (args.length === 2 && !args[0].startsWith("-") && /^\d+$/.test(args[1])) {
    return ["--host", args[0], "--port", args[1]];
  }
  return args;
}

function readArgValue(name, fallback) {
  const inline = viteArgs.find((arg) => arg.startsWith(`${name}=`));
  if (inline) return inline.slice(name.length + 1);
  const index = viteArgs.indexOf(name);
  if (index >= 0 && viteArgs[index + 1]) return viteArgs[index + 1];
  return fallback;
}

const frontendPort = readArgValue("--port", "5173");
const defaultOrigins = [
  `http://localhost:${frontendPort}`,
  `http://127.0.0.1:${frontendPort}`,
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const apiEnv = {
  ...process.env,
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? defaultOrigins.join(","),
};

const children = [
  spawn(process.execPath, ["server/index.mjs"], {
    env: apiEnv,
    stdio: "inherit",
  }),
  spawn(process.execPath, [viteBin, ...viteArgs], {
    env: process.env,
    stdio: "inherit",
  }),
];

let shuttingDown = false;

function stopAll(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill();
  }
  process.exit(exitCode);
}

for (const child of children) {
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    const exitCode = code ?? (signal ? 1 : 0);
    stopAll(exitCode);
  });
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
