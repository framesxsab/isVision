/**
 * NvidiaClient — Calls NVIDIA's free API endpoints for vision and NLP.
 *
 * Uses NVIDIA's API catalog which provides free inference for models like:
 * - Vision: meta/llama-4-maverick-17b-128e-instruct (or similar vision model)
 * - NLP: meta/llama-3.1-8b-instruct (for intent parsing)
 *
 * API keys are stored in .env (VITE_NVIDIA_VISION_API_KEY, etc.)
 * and accessed via import.meta.env.
 */

const NVIDIA_API_BASE = "https://integrate.api.nvidia.com/v1";

interface NvidiaMessage {
  role: "system" | "user" | "assistant";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

interface NvidiaResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

async function callNvidiaAPI(
  model: string,
  messages: NvidiaMessage[],
  apiKey: string,
  maxTokens: number = 1024
): Promise<string> {
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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`NVIDIA API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as NvidiaResponse;
  return data.choices[0]?.message.content ?? "No response received.";
}

/**
 * Describe an image using NVIDIA's vision model.
 * @param base64Image - Base64-encoded image (JPEG or PNG)
 * @param context - Optional context about what the user is looking at
 * @returns Detailed text description of the image
 */
export async function describeImage(
  base64Image: string,
  context?: string
): Promise<string> {
  const apiKey = import.meta.env.VITE_NVIDIA_VISION_API_KEY as string;
  if (!apiKey) {
    throw new Error("NVIDIA Vision API key not configured. Add VITE_NVIDIA_VISION_API_KEY to your .env file.");
  }

  const systemPrompt =
    "You are a visual assistant for a blind user. Describe the image in detail, focusing on: text content, people, objects, spatial layout, colors, and any safety-relevant information (traffic, obstacles). Be concise but thorough. Start with the most important information.";

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    {
      type: "image_url",
      image_url: {
        url: `data:image/jpeg;base64,${base64Image}`,
      },
    },
    {
      type: "text",
      text: context ?? "Describe this image for a blind user.",
    },
  ];

  return callNvidiaAPI(
    "meta/llama-4-maverick-17b-128e-instruct",
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    apiKey,
    1024
  );
}

/**
 * Parse a voice command into an intent using NVIDIA's NLP model.
 * @param transcript - What the user said
 * @param availableCommands - List of available command names
 * @returns Parsed command name or null
 */
export async function parseIntent(
  transcript: string,
  availableCommands: string[]
): Promise<{ command: string | null; confidence: number }> {
  const apiKey = import.meta.env.VITE_NVIDIA_API_KEY as string;
  if (!apiKey) {
    return { command: null, confidence: 0 };
  }

  const systemPrompt = `Map the user's voice command to one of these available commands: ${availableCommands.join(", ")}. Return ONLY valid JSON: {"command": "matched_command_or_null", "confidence": 0.0_to_1.0}. If no match, return {"command": null, "confidence": 0}.`;

  try {
    const response = await callNvidiaAPI(
      "meta/llama-3.1-8b-instruct",
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      apiKey,
      100
    );

    return JSON.parse(response) as { command: string | null; confidence: number };
  } catch {
    return { command: null, confidence: 0 };
  }
}
