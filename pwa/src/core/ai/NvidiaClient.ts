/**
 * Client-side AI helpers.
 *
 * The browser must not hold provider API keys. These helpers call same-origin
 * API routes, and the server reads provider keys from non-VITE environment
 * variables.
 */

const API_VISION = "/api/vision/describe";
const API_INTENT = "/api/voice/intent";

interface VisionResponse {
  description?: string;
  error?: string;
}

interface IntentResponse {
  command: string | null;
  confidence: number;
  error?: string;
}

export async function describeImage(
  base64Image: string,
  context?: string
): Promise<string> {
  const response = await fetch(API_VISION, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base64Image, context }),
  });

  const data = (await response.json().catch(() => ({}))) as VisionResponse;

  if (!response.ok || !data.description) {
    throw new Error(data.error ?? "Vision service is not available.");
  }

  return data.description;
}

export async function parseIntent(
  transcript: string,
  availableCommands: string[]
): Promise<{ command: string | null; confidence: number }> {
  const response = await fetch(API_INTENT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transcript, availableCommands }),
  });

  if (!response.ok) return { command: null, confidence: 0 };

  const data = (await response.json().catch(() => ({}))) as IntentResponse;
  return {
    command: data.command ?? null,
    confidence: typeof data.confidence === "number" ? data.confidence : 0,
  };
}
