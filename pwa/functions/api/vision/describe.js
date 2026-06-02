import { callNvidia } from "../../_shared/nvidia.js";

const SYSTEM_PROMPT =
  "You are a visual assistant for a blind user. Describe the image in detail, focusing on text content, people, objects, spatial layout, colors, and safety-relevant information. Be concise and start with the most important information.";

export async function onRequestPost({ request, env }) {
  const apiKey = env.NVIDIA_VISION_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Vision API key not configured." }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { base64Image, context } = body ?? {};
  if (typeof base64Image !== "string" || !base64Image) {
    return Response.json({ error: "base64Image is required." }, { status: 400 });
  }

  try {
    const description = await callNvidia(
      apiKey,
      env.NVIDIA_VISION_MODEL ?? "google/paligemma",
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } },
            {
              type: "text",
              text: typeof context === "string" && context.trim()
                ? context
                : "Describe this image for a blind user.",
            },
          ],
        },
      ],
      1024,
      env.NVIDIA_VISION_API_URL,
    );
    return Response.json({ description });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Vision service error." },
      { status: 502 },
    );
  }
}
