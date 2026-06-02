import { callNvidia } from "../../_shared/nvidia.js";

export async function onRequestPost({ request, env }) {
  const apiKey = env.NVIDIA_API_KEY;
  // Intent parsing is optional — if no key, fall through to client-side matching.
  if (!apiKey) {
    return Response.json({ command: null, confidence: 0 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { transcript, availableCommands } = body ?? {};
  if (typeof transcript !== "string" || !Array.isArray(availableCommands)) {
    return Response.json(
      { error: "transcript and availableCommands are required." },
      { status: 400 },
    );
  }

  const systemPrompt = `Map the user's voice command to one of these available commands: ${availableCommands.join(", ")}. Return ONLY valid JSON: {"command": "matched_command_or_null", "confidence": 0.0_to_1.0}. If no match, return {"command": null, "confidence": 0}.`;

  try {
    const result = await callNvidia(
      apiKey,
      env.NVIDIA_INTENT_MODEL ?? "meta/llama-3.1-8b-instruct",
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: transcript },
      ],
      100,
    );
    try {
      return Response.json(JSON.parse(result));
    } catch {
      return Response.json({ command: null, confidence: 0 });
    }
  } catch {
    return Response.json({ command: null, confidence: 0 });
  }
}
