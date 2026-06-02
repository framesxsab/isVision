// Cloudflare Worker entry. Routes /api/* to the existing Pages-style
// handlers under ../functions/api and delegates everything else to the
// static asset binding. The pwa/functions/ directory is a Pages
// convention; the project deploys to Workers via `wrangler deploy`, so
// without this entry the API handlers would not be wired up at all.

import { onRequestPost as visionDescribe } from "../functions/api/vision/describe.js";
import { onRequestPost as voiceIntent } from "../functions/api/voice/intent.js";
import { onRequestPost as readerFetch } from "../functions/api/reader/fetch.js";

const API_ROUTES = {
  "/api/vision/describe": visionDescribe,
  "/api/voice/intent": voiceIntent,
  "/api/reader/fetch": readerFetch,
};

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: JSON_HEADERS,
  });
}

function buildOriginAllowlist(env, url) {
  const allowed = new Set();
  // Always allow the deployed origin itself.
  allowed.add(`${url.protocol}//${url.host}`);
  for (const raw of (env.ALLOWED_ORIGINS ?? "").split(",")) {
    const trimmed = raw.trim();
    if (trimmed) allowed.add(trimmed);
  }
  return allowed;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      const handler = API_ROUTES[url.pathname];
      if (!handler) return jsonError(404, "Unknown API route.");
      if (request.method !== "POST") return jsonError(405, "Method not allowed.");

      // Browsers attach Origin to every cross-site fetch; a missing Origin
      // header means the caller is not a browser obeying same-origin policy
      // (curl, server-to-server). Treat both missing and disallowed origins
      // as forbidden so the deployed API is not an open relay for the
      // NVIDIA quota.
      const origin = request.headers.get("Origin");
      const allowed = buildOriginAllowlist(env, url);
      if (!origin || !allowed.has(origin)) {
        return jsonError(403, "Origin not allowed.");
      }

      // Optional bearer token, matched against an env-configured secret.
      // Leave API_TOKEN unset for casual deploys; set it via
      // `wrangler secret put API_TOKEN` to require it.
      if (env.API_TOKEN) {
        const header = request.headers.get("Authorization") ?? "";
        const match = header.match(/^Bearer\s+(.+)$/);
        if (!match || match[1] !== env.API_TOKEN) {
          return jsonError(401, "Unauthorized.");
        }
      }

      return handler({ request, env });
    }

    return env.ASSETS.fetch(request);
  },
};
