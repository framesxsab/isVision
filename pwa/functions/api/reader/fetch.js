// SSRF guard — block private/reserved IP literals before making outbound requests.
// Cloudflare's network also blocks RFC 1918 outbound at the infrastructure level,
// but we check URL literals explicitly for defence in depth.

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const MAX_REDIRECTS = 3;

const PRIVATE_V4_RANGES = [
  [0x00000000, 0xff000000], // 0.0.0.0/8
  [0x0a000000, 0xff000000], // 10.0.0.0/8
  [0x64400000, 0xffc00000], // 100.64.0.0/10 (CGNAT)
  [0x7f000000, 0xff000000], // 127.0.0.0/8 (loopback)
  [0xa9fe0000, 0xffff0000], // 169.254.0.0/16 (link-local / metadata)
  [0xac100000, 0xfff00000], // 172.16.0.0/12
  [0xc0000000, 0xffffff00], // 192.0.0.0/24
  [0xc0000200, 0xffffff00], // 192.0.2.0/24 (TEST-NET-1)
  [0xc0a80000, 0xffff0000], // 192.168.0.0/16
  [0xc6120000, 0xfffffe00], // 198.18.0.0/15
  [0xc6336400, 0xffffff00], // 198.51.100.0/24 (TEST-NET-2)
  [0xcb007100, 0xffffff00], // 203.0.113.0/24 (TEST-NET-3)
  [0xe0000000, 0xf0000000], // 224.0.0.0/4 (multicast)
  [0xf0000000, 0xf0000000], // 240.0.0.0/4 (reserved)
];

function ipv4ToInt(ip) {
  const parts = ip.split(".");
  if (parts.length !== 4) return NaN;
  return parts.reduce((acc, p) => {
    const n = parseInt(p, 10);
    return isNaN(n) || n < 0 || n > 255 ? NaN : (acc * 256 + n) >>> 0;
  }, 0);
}

function isBlockedIPv4(hostname) {
  const n = ipv4ToInt(hostname);
  if (isNaN(n)) return false;
  return PRIVATE_V4_RANGES.some(([base, mask]) => (n & mask) === (base & mask));
}

function isBlockedIPv6(hostname) {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "::1" || h === "::") return true;
  if (h.startsWith("::ffff:")) {
    const v4 = h.slice(7);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return isBlockedIPv4(v4);
  }
  const first = parseInt(h.split(":")[0] || "0", 16);
  if (isNaN(first)) return true;
  if (first >= 0xfc00 && first <= 0xfdff) return true; // ULA fc00::/7
  if (first >= 0xfe80 && first <= 0xfebf) return true; // link-local fe80::/10
  return false;
}

function assertAllowed(hostname) {
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && isBlockedIPv4(hostname)) {
    throw new Error("URL resolves to a private address.");
  }
  if ((hostname.startsWith("[") || hostname.includes(":")) && isBlockedIPv6(hostname)) {
    throw new Error("URL resolves to a private address.");
  }
}

async function fetchSafely(rawUrl, hops = 0) {
  if (hops > MAX_REDIRECTS) throw new Error("Too many redirects.");

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed.");
  }
  assertAllowed(url.hostname);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "User-Agent": "isVisible-Reader/1.0",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5",
    },
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("location");
    if (!location) throw new Error("Redirect with no Location header.");
    return fetchSafely(new URL(location, url.toString()).toString(), hops + 1);
  }

  if (!res.ok) throw new Error(`Upstream returned ${res.status}.`);

  const reader = res.body?.getReader();
  if (!reader) return "";

  let total = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error(`Response exceeds ${MAX_BYTES} bytes.`);
    }
    chunks.push(value);
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(merged);
}

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!url) return Response.json({ error: "url is required." }, { status: 400 });

  try {
    const html = await fetchSafely(url);
    return Response.json({ html });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Fetch failed." },
      { status: 400 },
    );
  }
}
