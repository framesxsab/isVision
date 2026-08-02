import { callNvidia } from "../../_shared/nvidia.js";
import {
  buildIntentAllowedNames,
  buildIntentSystemPrompt,
  buildIntentUserPrompt,
  parseIntentModelResult,
  sanitizeIntentCatalog,
} from "../../_shared/intent.js";

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

  const { transcript, availableCommands, alternatives, commandCatalog } = body ?? {};
  if (typeof transcript !== "string" || !Array.isArray(availableCommands)) {
    return Response.json(
      { error: "transcript and availableCommands are required." },
      { status: 400 },
    );
  }

  const catalog = sanitizeIntentCatalog(commandCatalog, availableCommands);
  const allowedNames = buildIntentAllowedNames(catalog, availableCommands);

  try {
    const result = await callNvidia(
      apiKey,
      env.NVIDIA_INTENT_MODEL ?? "meta/llama-3.1-8b-instruct",
      [
        { role: "system", content: buildIntentSystemPrompt(catalog, availableCommands) },
        { role: "user", content: buildIntentUserPrompt(transcript, alternatives) },
      ],
      100,
    );
    return Response.json(parseIntentModelResult(result, allowedNames));
  } catch {
    return Response.json({ command: null, confidence: 0 });
  }
}
