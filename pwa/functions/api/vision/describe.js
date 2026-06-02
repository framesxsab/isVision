// NVIDIA's VLM endpoint for vision-language models (PaliGemma, Kosmos-2,
// NVLM, etc.) expects the image embedded inline in the user message
// content as <img src="data:image/jpeg;base64,..."/>, not the separate
// image_url content-type array that the chat-completions endpoint uses.
// We POST directly here rather than going through _shared/nvidia.js so
// voice intent (chat-completions) and vision (VLM) can each keep their
// native request shape.

const DEFAULT_ENDPOINT = "https://ai.api.nvidia.com/v1/vlm/google/paligemma";

const PROMPT_PREFIX =
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

  const endpoint = env.NVIDIA_VISION_API_URL?.trim() || DEFAULT_ENDPOINT;
  const userContext = typeof context === "string" && context.trim()
    ? context.trim()
    : "Describe this image for a blind user.";
  const prompt = `${PROMPT_PREFIX} ${userContext} <img src="data:image/jpeg;base64,${base64Image}" />`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        temperature: 0.2,
        top_p: 0.7,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return Response.json(
        { error: `NVIDIA VLM error (${res.status}): ${text || res.statusText}` },
        { status: 502 },
      );
    }

    const data = await res.json();
    const description = data?.choices?.[0]?.message?.content ?? "";
    return Response.json({ description });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Vision service error." },
      { status: 502 },
    );
  }
}
