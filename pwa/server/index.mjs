import http from "node:http";

const NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1";
const PORT = Number.parseInt(process.env.PORT ?? "8787", 10);
const MAX_BODY_BYTES = 8 * 1024 * 1024;
const UPSTREAM_TIMEOUT_MS = Number.parseInt(process.env.UPSTREAM_TIMEOUT_MS ?? "30000", 10);

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

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;

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

    sendJson(res, 404, { error: "Not found." }, origin);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error.";
    sendJson(res, 500, { error: message }, origin);
  }
});

// Graceful shutdown so orchestrators don't lose in-flight requests.
function shutdown(signal) {
  console.log(`Received ${signal}, closing server...`);
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
  // Force-exit if close hangs.
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

server.listen(PORT, () => {
  console.log(`isVisible API server listening on http://localhost:${PORT}`);
  console.log(`  ALLOWED_ORIGINS: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`  API_TOKEN: ${API_TOKEN ? "set (auth required)" : "unset (auth disabled)"}`);
  console.log(`  UPSTREAM_TIMEOUT_MS: ${UPSTREAM_TIMEOUT_MS}`);
});
