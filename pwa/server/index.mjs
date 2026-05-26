import http from "node:http";
import dns from "node:dns/promises";
import { isIP } from "node:net";

// One JSON line per event so logs are grep-able and ingestable by any log
// aggregator (Cloud Run, Datadog, Loki, etc.). Levels follow the standard
// debug < info < warn < error ordering; set LOG_LEVEL=warn in prod to drop
// per-request access logs and keep only problems.
const LOG_LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL ?? "info"] ?? LOG_LEVELS.info;

function log(level, msg, fields = {}) {
  if ((LOG_LEVELS[level] ?? 0) < LOG_LEVEL) return;
  const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
  stream.write(
    JSON.stringify({
      ts: new Date().toISOString(),
      level,
      msg,
      ...fields,
    }) + "\n"
  );
}

const NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1";
const PORT = Number.parseInt(process.env.PORT ?? "8787", 10);
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = Number.parseInt(process.env.UPSTREAM_TIMEOUT_MS ?? "30000", 10);

const READER_FETCH_MAX_BYTES = Number.parseInt(process.env.READER_FETCH_MAX_BYTES ?? "2097152", 10);
const READER_FETCH_TIMEOUT_MS = Number.parseInt(process.env.READER_FETCH_TIMEOUT_MS ?? "10000", 10);
const READER_FETCH_MAX_REDIRECTS = 3;

// Origin allowlist. Only requests whose Origin header matches one of these are
// served. Defaults cover Vite dev (5173) and preview (4173). In production set
// ALLOWED_ORIGINS to the deployed origin(s), comma-separated.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173,http://localhost:4173")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Optional shared secret. If set, /api/* requires Authorization: Bearer <value>.
// Leave unset in dev. Required for any publicly reachable deployment.
const API_TOKEN = process.env.API_TOKEN ?? "";

// Per-IP sliding-window rate limits. Tune via env if needed.
const RATE_LIMITS = {
  "/api/vision/describe": {
    max: Number.parseInt(process.env.VISION_RATE_MAX ?? "20", 10),
    windowMs: Number.parseInt(process.env.VISION_RATE_WINDOW_MS ?? "60000", 10),
  },
  "/api/voice/intent": {
    max: Number.parseInt(process.env.INTENT_RATE_MAX ?? "60", 10),
    windowMs: Number.parseInt(process.env.INTENT_RATE_WINDOW_MS ?? "60000", 10),
  },
  "/api/reader/fetch": {
    max: Number.parseInt(process.env.READER_RATE_MAX ?? "30", 10),
    windowMs: Number.parseInt(process.env.READER_RATE_WINDOW_MS ?? "60000", 10),
  },
};

const requestLog = new Map(); // `${ip}|${route}` -> number[] of request timestamps

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of requestLog) {
    const route = key.split("|")[1];
    const windowMs = RATE_LIMITS[route]?.windowMs ?? 60_000;
    const fresh = timestamps.filter((t) => now - t < windowMs);
    if (fresh.length === 0) requestLog.delete(key);
    else requestLog.set(key, fresh);
  }
}, 60_000).unref();

function isAllowedOrigin(origin) {
  return Boolean(origin) && ALLOWED_ORIGINS.includes(origin);
}

function isAuthorized(req) {
  if (!API_TOKEN) return true;
  const header = req.headers.authorization ?? "";
  const match = header.match(/^Bearer\s+(.+)$/);
  return Boolean(match) && match[1] === API_TOKEN;
}

function clientIp(req) {
  // Trust X-Forwarded-For only when running behind a reverse proxy.
  // Out of the box (no TRUST_PROXY), we use the raw socket address so a
  // malicious client cannot spoof their IP for rate-limit bypass.
  if (process.env.TRUST_PROXY === "1") {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string" && xff.length > 0) {
      return xff.split(",")[0].trim();
    }
  }
  return req.socket.remoteAddress ?? "unknown";
}

function isRateLimited(req, route) {
  const config = RATE_LIMITS[route];
  if (!config) return false;
  const key = `${clientIp(req)}|${route}`;
  const now = Date.now();
  const timestamps = (requestLog.get(key) ?? []).filter((t) => now - t < config.windowMs);
  if (timestamps.length >= config.max) {
    requestLog.set(key, timestamps);
    return true;
  }
  timestamps.push(now);
  requestLog.set(key, timestamps);
  return false;
}

function securityHeaders(origin) {
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  };
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

function sendJson(res, status, body, origin) {
  res.writeHead(status, securityHeaders(origin));
  res.end(JSON.stringify(body));
}

function handlePreflight(req, res) {
  const origin = req.headers.origin;
  const headers = {};
  if (isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization";
    headers["Access-Control-Max-Age"] = "600";
    headers["Vary"] = "Origin";
  }
  res.writeHead(204, headers);
  res.end();
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });
    req.on("error", reject);
  });
}

async function callNvidiaAPI(model, messages, apiKey, maxTokens = 1024) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(`${NVIDIA_API_BASE}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: maxTokens,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`NVIDIA API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error(`Upstream timeout after ${UPSTREAM_TIMEOUT_MS}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function describeImage(req, res, origin) {
  const apiKey = process.env.NVIDIA_VISION_API_KEY;
  if (!apiKey) {
    sendJson(res, 500, { error: "Vision API key is not configured on the server." }, origin);
    return;
  }

  const { base64Image, context } = await readJson(req);
  if (typeof base64Image !== "string" || base64Image.length === 0) {
    sendJson(res, 400, { error: "base64Image is required." }, origin);
    return;
  }

  const systemPrompt =
    "You are a visual assistant for a blind user. Describe the image in detail, focusing on text content, people, objects, spatial layout, colors, and safety-relevant information. Be concise and start with the most important information.";

  const description = await callNvidiaAPI(
    process.env.NVIDIA_VISION_MODEL ?? "meta/llama-4-maverick-17b-128e-instruct",
    [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${base64Image}` },
          },
          {
            type: "text",
            text:
              typeof context === "string" && context.trim()
                ? context
                : "Describe this image for a blind user.",
          },
        ],
      },
    ],
    apiKey,
    1024
  );

  sendJson(res, 200, { description }, origin);
}

async function parseIntent(req, res, origin) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) {
    sendJson(res, 200, { command: null, confidence: 0 }, origin);
    return;
  }

  const { transcript, availableCommands } = await readJson(req);
  if (typeof transcript !== "string" || !Array.isArray(availableCommands)) {
    sendJson(res, 400, { error: "transcript and availableCommands are required." }, origin);
    return;
  }

  const systemPrompt = `Map the user's voice command to one of these available commands: ${availableCommands.join(", ")}. Return ONLY valid JSON: {"command": "matched_command_or_null", "confidence": 0.0_to_1.0}. If no match, return {"command": null, "confidence": 0}.`;

  const result = await callNvidiaAPI(
    process.env.NVIDIA_INTENT_MODEL ?? "meta/llama-3.1-8b-instruct",
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcript },
    ],
    apiKey,
    100
  );

  try {
    sendJson(res, 200, JSON.parse(result), origin);
  } catch {
    sendJson(res, 200, { command: null, confidence: 0 }, origin);
  }
}

// --- SSRF-safe URL fetcher (used by /api/reader/fetch) -----------------------

// IPv4 ranges the fetcher must refuse to connect to. RFC 1918 + IETF
// special-purpose registries. Each entry is [base, prefix-length].
const PRIVATE_V4 = [
  ["0.0.0.0", 8],          // "this network"
  ["10.0.0.0", 8],         // RFC 1918
  ["100.64.0.0", 10],      // carrier-grade NAT
  ["127.0.0.0", 8],        // loopback
  ["169.254.0.0", 16],     // link-local (includes cloud metadata 169.254.169.254)
  ["172.16.0.0", 12],      // RFC 1918
  ["192.0.0.0", 24],       // IETF protocol assignments
  ["192.0.2.0", 24],       // TEST-NET-1
  ["192.168.0.0", 16],     // RFC 1918
  ["198.18.0.0", 15],      // network benchmarking
  ["198.51.100.0", 24],    // TEST-NET-2
  ["203.0.113.0", 24],     // TEST-NET-3
  ["224.0.0.0", 4],        // multicast
  ["240.0.0.0", 4],        // reserved
];

function ipv4ToInt(ip) {
  return ip.split(".").reduce((a, o) => (a << 8) | (Number(o) & 0xff), 0) >>> 0;
}

function isPrivateIPv4(ip) {
  const num = ipv4ToInt(ip);
  for (const [base, prefix] of PRIVATE_V4) {
    const baseNum = ipv4ToInt(base);
    const mask = prefix === 0 ? 0 : ((~0 << (32 - prefix)) >>> 0);
    if ((num & mask) === (baseNum & mask)) return true;
  }
  return false;
}

function isPrivateIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — recurse on the v4 part.
  if (lower.startsWith("::ffff:")) {
    const v4 = lower.slice(7);
    if (isIP(v4) === 4) return isPrivateIPv4(v4);
  }

  // Parse the first 16-bit group as a hex number.
  const firstGroup = lower.split(":")[0];
  if (!firstGroup) return true;
  const firstNum = Number.parseInt(firstGroup, 16);
  if (!Number.isFinite(firstNum)) return true;

  // Unique local fc00::/7 (0xfc00–0xfdff).
  if (firstNum >= 0xfc00 && firstNum <= 0xfdff) return true;
  // Link-local fe80::/10 (0xfe80–0xfebf).
  if (firstNum >= 0xfe80 && firstNum <= 0xfebf) return true;
  // Global unicast is 2000::/3 (0x2000–0x3fff). Anything outside is reserved
  // or unallocated — deny by default.
  if (firstNum < 0x2000 || firstNum > 0x3fff) return true;
  // Documentation 2001:db8::/32.
  if (firstNum === 0x2001 && lower.split(":")[1] === "db8") return true;

  return false;
}

async function assertHostnamePublic(hostname) {
  const kind = isIP(hostname);
  if (kind === 4) {
    if (isPrivateIPv4(hostname)) throw new Error(`URL resolves to a private address (${hostname}).`);
    return;
  }
  if (kind === 6) {
    if (isPrivateIPv6(hostname)) throw new Error(`URL resolves to a private address (${hostname}).`);
    return;
  }
  let records;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    throw new Error(`Could not resolve ${hostname}.`);
  }
  for (const { address, family } of records) {
    if (family === 4 && isPrivateIPv4(address)) {
      throw new Error(`URL resolves to a private address (${address}).`);
    }
    if (family === 6 && isPrivateIPv6(address)) {
      throw new Error(`URL resolves to a private address (${address}).`);
    }
  }
}

async function fetchUrlSafely(rawUrl, hops = 0) {
  if (hops > READER_FETCH_MAX_REDIRECTS) {
    throw new Error("Too many redirects.");
  }
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed.");
  }
  await assertHostnamePublic(url.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READER_FETCH_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "isVisible-Reader/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
      },
      redirect: "manual",
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err && err.name === "AbortError") throw new Error("Upstream timeout.");
    throw new Error("Upstream fetch failed.");
  }
  clearTimeout(timer);

  // Manual redirect handling so each hop gets re-checked for SSRF.
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");
    if (!location) throw new Error("Redirect with no Location header.");
    const next = new URL(location, url.toString()).toString();
    return fetchUrlSafely(next, hops + 1);
  }

  if (!response.ok) {
    throw new Error(`Upstream returned ${response.status}.`);
  }

  // Stream-read with a hard byte cap so a hostile site can't tar-pit us.
  const reader = response.body?.getReader();
  if (!reader) return "";
  let total = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > READER_FETCH_MAX_BYTES) {
      await reader.cancel();
      throw new Error(`Response exceeds ${READER_FETCH_MAX_BYTES} bytes.`);
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

async function readerFetch(req, res, origin) {
  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    sendJson(res, 400, { error: err instanceof Error ? err.message : "Invalid request." }, origin);
    return;
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!url) {
    sendJson(res, 400, { error: "url is required." }, origin);
    return;
  }
  try {
    const html = await fetchUrlSafely(url);
    sendJson(res, 200, { html }, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Fetch failed.";
    sendJson(res, 400, { error: message }, origin);
  }
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  const startNs = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number((process.hrtime.bigint() - startNs) / 1_000_000n);
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    log(level, "request", {
      method: req.method,
      path: req.url?.split("?")[0],
      status: res.statusCode,
      durationMs,
      ip: clientIp(req),
      origin: origin ?? "-",
    });
  });

  try {
    // CORS preflight.
    if (req.method === "OPTIONS" && req.url?.startsWith("/api/")) {
      handlePreflight(req, res);
      return;
    }

    // Health check — unauthenticated, ungated. For orchestrators.
    if (req.method === "GET" && req.url === "/healthz") {
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // Everything below is gated.
    if (req.url?.startsWith("/api/")) {
      if (!isAllowedOrigin(origin)) {
        sendJson(res, 403, { error: "Origin not allowed." }, origin);
        return;
      }
      if (!isAuthorized(req)) {
        sendJson(res, 401, { error: "Unauthorized." }, origin);
        return;
      }
      if (isRateLimited(req, req.url)) {
        res.writeHead(429, {
          ...securityHeaders(origin),
          "Retry-After": "60",
        });
        res.end(JSON.stringify({ error: "Rate limit exceeded. Try again in a minute." }));
        return;
      }
    }

    if (req.method === "POST" && req.url === "/api/vision/describe") {
      await describeImage(req, res, origin);
      return;
    }

    if (req.method === "POST" && req.url === "/api/voice/intent") {
      await parseIntent(req, res, origin);
      return;
    }

    if (req.method === "POST" && req.url === "/api/reader/fetch") {
      await readerFetch(req, res, origin);
      return;
    }

    sendJson(res, 404, { error: "Not found." }, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error.";
    log("error", "handler_exception", {
      path: req.url?.split("?")[0],
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
    });
    sendJson(res, 500, { error: message }, origin);
  }
});

// Graceful shutdown so orchestrators don't lose in-flight requests.
function shutdown(signal) {
  log("info", "shutdown_start", { signal });
  server.close(() => {
    log("info", "shutdown_done");
    process.exit(0);
  });
  // Force-exit if close hangs.
  setTimeout(() => {
    log("error", "shutdown_forced");
    process.exit(1);
  }, 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  log("error", "uncaught_exception", { error: err.message, stack: err.stack });
});
process.on("unhandledRejection", (reason) => {
  log("error", "unhandled_rejection", {
    error: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

server.listen(PORT, () => {
  log("info", "listening", {
    port: PORT,
    allowedOrigins: ALLOWED_ORIGINS,
    authRequired: Boolean(API_TOKEN),
    upstreamTimeoutMs: UPSTREAM_TIMEOUT_MS,
    logLevel: process.env.LOG_LEVEL ?? "info",
  });
});
