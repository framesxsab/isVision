// Shared voice-intent helpers used by both the Cloudflare Worker handler
// (functions/api/voice/intent.js) and the local Node dev server
// (server/index.mjs).
//
// These are the security-critical pieces of intent resolution: they bound the
// prompt size, neutralise client-supplied text (whitespace collapsing also
// defeats simple prompt-injection attempts), restrict the model's output to a
// known command-name allowlist, and clamp confidence to [0, 1]. Keeping them
// in one place means the two deployment targets can't drift, and the logic is
// unit-tested once instead of twice.

export const MAX_INTENT_COMMANDS = 120;
export const MAX_INTENT_PATTERNS_PER_COMMAND = 10;
export const MAX_INTENT_TEXT = 3000;

export function normalizeIntentText(value, max = 160) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";
}

export function clampIntentConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(1, number));
}

export function extractIntentJsonObject(text) {
  const raw = normalizeIntentText(text, MAX_INTENT_TEXT);
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

export function sanitizeIntentCatalog(commandCatalog, availableCommands) {
  const allowed = new Set(
    availableCommands
      .filter((command) => typeof command === "string")
      .map((command) => command.trim())
      .filter(Boolean),
  );

  if (!Array.isArray(commandCatalog)) return [];

  return commandCatalog
    .filter((command) => command && typeof command === "object")
    .map((command) => {
      const name = normalizeIntentText(command.name, 80);
      if (!name || !allowed.has(name)) return null;
      const patterns = Array.isArray(command.patterns)
        ? command.patterns
            .map((pattern) => normalizeIntentText(pattern, 80))
            .filter(Boolean)
            .slice(0, MAX_INTENT_PATTERNS_PER_COMMAND)
        : [];
      return {
        name,
        description: normalizeIntentText(command.description, 160),
        module: normalizeIntentText(command.module, 80),
        patterns,
      };
    })
    .filter(Boolean)
    .slice(0, MAX_INTENT_COMMANDS);
}

export function buildIntentAllowedNames(catalog, availableCommands) {
  return new Set(
    catalog.length > 0
      ? catalog.map((command) => command.name)
      : availableCommands.filter((command) => typeof command === "string"),
  );
}

export function formatIntentCatalog(catalog, availableCommands) {
  if (catalog.length > 0) {
    return catalog
      .map((command) => {
        const examples = command.patterns.length
          ? ` Examples: ${command.patterns.join("; ")}.`
          : "";
        return `- ${command.name}: ${command.description} Module: ${command.module}.${examples}`;
      })
      .join("\n");
  }

  return availableCommands
    .filter((command) => typeof command === "string")
    .map((command) => `- ${normalizeIntentText(command, 80)}`)
    .slice(0, MAX_INTENT_COMMANDS)
    .join("\n");
}

export function parseIntentModelResult(text, allowedNames) {
  const parsed = extractIntentJsonObject(text);
  if (!parsed || typeof parsed !== "object") {
    return { command: null, confidence: 0 };
  }

  const command = typeof parsed.command === "string" ? parsed.command.trim() : null;
  if (!command || !allowedNames.has(command)) {
    return { command: null, confidence: 0 };
  }

  return { command, confidence: clampIntentConfidence(parsed.confidence) };
}

export function buildIntentSystemPrompt(catalog, availableCommands) {
  return [
    "You are the voice intent router for isVisible, an accessibility app for blind and low-vision users.",
    "Choose exactly one command from the catalog when the user's words clearly ask for that action.",
    "Users may speak naturally, hesitate, use synonyms, or ask for an outcome instead of the exact command phrase.",
    "Prefer navigation commands for requests to open, use, start, go to, or practice a tool.",
    "Return null for unrelated conversation, unsafe guesses, or requests that are only questions about how the app works.",
    'Return ONLY valid JSON in this shape: {"command":"command_name_or_null","confidence":0.0}.',
    "The command value must be one of the catalog command names, not an example phrase.",
    "",
    "Command catalog:",
    formatIntentCatalog(catalog, availableCommands),
  ].join("\n");
}

export function buildIntentUserPrompt(transcript, alternatives = []) {
  const transcriptAlternatives = Array.isArray(alternatives)
    ? alternatives.map((item) => normalizeIntentText(item, 160)).filter(Boolean).slice(0, 5)
    : [];
  return [
    `Transcript: ${normalizeIntentText(transcript, 500)}`,
    transcriptAlternatives.length
      ? `Other recognition alternatives: ${transcriptAlternatives.join(" | ")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}
