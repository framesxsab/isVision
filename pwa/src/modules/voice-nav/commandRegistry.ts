/**
 * Command Registry — Maps voice commands to actions.
 *
 * Matching pipeline (highest confidence wins):
 *   1. Exact match on normalized input                 → 1.00
 *   2. Word-boundary substring match                   → 0.95
 *   3. Word-coverage: all pattern keywords in input    → 0.90
 *   4. Word-coverage: ≥75% pattern keywords in input  → 0.80
 *   5. Levenshtein fuzzy (character similarity)        → 0.55+
 *
 * Patterns cover natural speech variants so users don't need to memorise
 * exact phrases ("I want to open the reader" → open_reader, etc.).
 */

import { parseIntent } from "../../core/ai/NvidiaClient";

export interface Command {
  name: string;
  patterns: string[];
  description: string;
  module: string;
  action: string;
}

export interface VoiceCommandResolution {
  command: Command;
  confidence: number;
  matchedAlternative: string;
  source: "local" | "ai";
}

export interface ResolveVoiceCommandOptions {
  minLocalConfidence?: number;
  minAiConfidence?: number;
  aiTimeoutMs?: number;
  intentResolver?: (
    transcript: string,
    availableCommands: string[],
    context: {
      alternatives: string[];
      commandCatalog: CommandIntentCatalogItem[];
    }
  ) => Promise<{ command: string | null; confidence: number }>;
}

export interface CommandIntentCatalogItem {
  name: string;
  description: string;
  module: string;
  action: string;
  patterns: string[];
}

export const commands: Command[] = [
  // ── Global ────────────────────────────────────────────────────────────────
  {
    name: "help",
    patterns: [
      "help", "help me", "i need help", "what can i say",
      "list commands", "commands", "what can i do", "assistance",
    ],
    description: "List available voice commands",
    module: "global",
    action: "help",
  },
  {
    name: "go_home",
    patterns: [
      "go home", "home", "main menu", "back to home",
      "take me home", "go to home", "navigate home", "show home", "main screen",
    ],
    description: "Go to the home screen",
    module: "global",
    action: "navigate_home",
  },
  {
    name: "go_back",
    patterns: [
      "go back", "back", "previous page", "go to previous page",
      "navigate back", "return",
    ],
    description: "Go back to the previous page",
    module: "global",
    action: "navigate_back",
  },
  {
    name: "stop",
    patterns: [
      "stop", "be quiet", "silence", "shut up", "quiet",
      "stop talking", "mute", "enough",
    ],
    description: "Stop speaking",
    module: "global",
    action: "stop_speech",
  },
  {
    name: "repeat",
    patterns: [
      "repeat", "say again", "what did you say", "repeat that",
      "say that again", "once more",
    ],
    description: "Repeat the last spoken text",
    module: "global",
    action: "repeat",
  },
  {
    name: "settings",
    patterns: [
      "settings", "preferences", "options", "open settings",
      "go to settings", "open preferences", "configuration",
    ],
    description: "Open settings",
    module: "global",
    action: "navigate_settings",
  },

  // ── Touch Explorer ────────────────────────────────────────────────────────
  {
    name: "open_explorer",
    patterns: [
      "touch explorer", "explore", "open explorer", "touch mode",
      "open touch", "start touch explorer", "touch exploration", "explore screen",
    ],
    description: "Open Touch Explorer",
    module: "touch-explorer",
    action: "navigate_touch_explorer",
  },

  // ── AI Vision ─────────────────────────────────────────────────────────────
  {
    name: "open_vision",
    patterns: [
      "camera", "vision", "open camera", "ai vision",
      "open ai vision", "use camera", "open vision", "start camera",
      "what is in front of me", "see what is in front of me",
      "tell me what the camera sees", "look around",
    ],
    description: "Open AI Vision",
    module: "ai-vision",
    action: "navigate_ai_vision",
  },
  {
    name: "capture",
    patterns: [
      "capture", "take photo", "take picture", "snap",
      "describe what you see", "what do you see",
      "look at this", "describe surroundings", "analyze image", "describe",
    ],
    description: "Capture and describe image",
    module: "ai-vision",
    action: "capture_image",
  },

  // ── Reader ────────────────────────────────────────────────────────────────
  {
    name: "open_reader",
    patterns: [
      "reader", "open reader", "accessible reader",
      "open article", "read an article", "start reading", "open the reader",
      "article reader", "go to reader", "read a website", "read a web page",
      "read this website", "read this page", "read something online",
      "help me read an article",
    ],
    description: "Open Accessible Reader",
    module: "reader",
    action: "navigate_reader",
  },
  {
    name: "play",
    patterns: [
      "play", "start reading", "read aloud", "read this",
      "begin reading", "continue", "resume reading", "resume",
    ],
    description: "Start or resume reading",
    module: "reader",
    action: "reader_play",
  },
  {
    name: "pause",
    patterns: [
      "pause", "pause reading", "wait",
      "stop reading", "hold on", "pause it",
    ],
    description: "Pause reading",
    module: "reader",
    action: "reader_pause",
  },
  {
    name: "next",
    patterns: [
      "next", "next paragraph", "skip", "next section",
      "skip paragraph", "forward",
    ],
    description: "Skip to next paragraph",
    module: "reader",
    action: "reader_next",
  },
  {
    name: "previous",
    patterns: [
      "previous", "previous paragraph", "back one",
      "go previous", "last paragraph", "prior paragraph",
    ],
    description: "Go to previous paragraph",
    module: "reader",
    action: "reader_previous",
  },
  {
    name: "faster",
    patterns: [
      "faster", "speed up", "increase speed",
      "go faster", "more speed", "speed up reading",
    ],
    description: "Increase reading speed",
    module: "reader",
    action: "speed_up",
  },
  {
    name: "slower",
    patterns: [
      "slower", "slow down", "decrease speed",
      "go slower", "less speed", "slow down reading",
    ],
    description: "Decrease reading speed",
    module: "reader",
    action: "slow_down",
  },

  // ── Tactile Output ────────────────────────────────────────────────────────
  {
    name: "open_tactile_output",
    patterns: [
      "tactile output", "braille lab", "tactile lab", "open braille",
      "open tactile", "braille output", "open tactile output",
      "convert text to braille", "turn text into braille", "send braille",
    ],
    description: "Open Tactile Output Lab",
    module: "tactile-output",
    action: "navigate_tactile_output",
  },
  {
    name: "open_voice_nav",
    patterns: [
      "voice nav", "voice navigation", "open voice nav",
      "open voice navigation", "go to voice nav", "go to voice navigation",
    ],
    description: "Open Voice Navigation",
    module: "global",
    action: "navigate_voice_nav",
  },
  {
    name: "open_tactile_drill",
    patterns: [
      "tactile drill", "drill", "practice braille", "braille drill", "open drill",
      "braille practice", "practice", "start drill", "teach me braille",
      "help me practice braille", "learn braille",
    ],
    description: "Open Tactile Drill",
    module: "tactile-output",
    action: "navigate_tactile_drill",
  },
  {
    name: "drill_next",
    patterns: [
      "next drill", "next prompt", "next braille prompt", "drill next",
      "skip drill prompt",
    ],
    description: "Move to the next drill prompt",
    module: "tactile-output",
    action: "drill_next",
  },
  {
    name: "drill_previous",
    patterns: [
      "previous drill", "previous prompt", "last drill prompt", "drill back",
      "back in drill",
    ],
    description: "Go to the previous drill prompt",
    module: "tactile-output",
    action: "drill_previous",
  },
  {
    name: "drill_repeat",
    patterns: [
      "repeat prompt", "repeat drill", "repeat current prompt",
      "say drill prompt again",
    ],
    description: "Repeat the current drill prompt",
    module: "tactile-output",
    action: "drill_repeat",
  },
  {
    name: "drill_reset",
    patterns: [
      "reset drill", "reset score", "clear drill score", "start drill over",
    ],
    description: "Reset the drill score",
    module: "tactile-output",
    action: "drill_reset",
  },
];

// Filler words stripped before matching so natural phrasing like
// "please open the accessible reader" → "open accessible reader".
const FILLER_WORDS = new Set([
  "please", "the", "a", "an", "to", "now", "ok", "okay", "hey", "um", "uh",
  "could", "would", "can", "you", "for", "me", "i", "want", "need", "let",
  "us", "lets", "just", "like", "really", "actually", "so", "and", "or",
  "my", "your", "its",
]);

/** Normalize a transcript for matching: lowercase, strip punctuation/fillers. */
export function normalizeTranscript(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:'"()\-_/]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !FILLER_WORDS.has(word))
    .join(" ")
    .trim();
}

// Precomputed (pattern → command) index sorted longest-first so the most
// specific phrase wins when a transcript contains multiple shorter patterns.
const patternIndex = commands
  .flatMap((cmd) => cmd.patterns.map((pattern) => ({ cmd, pattern })))
  .sort((a, b) => b.pattern.length - a.pattern.length);

function buildCommandCatalog(): CommandIntentCatalogItem[] {
  return commands.map(({ name, description, module, action, patterns }) => ({
    name,
    description,
    module,
    action,
    patterns,
  }));
}

/**
 * Word-coverage score: how many of the pattern's significant words appear
 * in the normalized input. Only fires if ≥ 75 % of pattern words are found.
 *
 * Returns 0 when coverage is below the threshold (no match), otherwise
 * returns a confidence in [0.75, 0.90] penalised slightly for extra words
 * in the input that aren't part of the pattern (noise).
 */
export function wordCoverageScore(inputNormalized: string, pattern: string): number {
  const inputWords = new Set(inputNormalized.split(/\s+/).filter(Boolean));
  const patternWords = normalizeTranscript(pattern)
    .split(/\s+/)
    .filter(Boolean);
  if (patternWords.length === 0 || inputWords.size === 0) return 0;

  const found = patternWords.filter((w) => inputWords.has(w)).length;
  const coverage = found / patternWords.length;
  if (coverage < 0.75) return 0;

  // Small noise penalty: each extra word in input that isn't in the pattern
  // reduces confidence slightly, preventing a very noisy utterance from
  // scoring the same as a clean one.
  const noise = Math.max(0, inputWords.size - found);
  const penalty = noise * 0.03;
  return Math.max(0.70, coverage * 0.90 - penalty);
}

/**
 * Find the best matching command across all browser-returned alternatives.
 * Tries each alternative, picks the highest-confidence hit overall.
 */
export function matchCommandWithAlternatives(
  alternatives: string[]
): { command: Command; confidence: number; matchedAlternative: string } | null {
  let best: { command: Command; confidence: number; matchedAlternative: string } | null = null;

  for (const alt of alternatives) {
    const result = matchCommand(alt);
    if (result && (!best || result.confidence > best.confidence)) {
      best = { ...result, matchedAlternative: alt };
      if (result.confidence >= 1.0) return best;
    }
  }

  return best;
}

/**
 * Find the best matching command for a single transcript.
 * Pipeline: normalize → exact → substring → word-coverage → Levenshtein.
 */
export async function resolveVoiceCommand(
  alternatives: string[],
  options: ResolveVoiceCommandOptions = {}
): Promise<VoiceCommandResolution | null> {
  const localMatch = matchCommandWithAlternatives(alternatives);
  const minLocalConfidence = options.minLocalConfidence ?? 0.75;
  const minAiConfidence = options.minAiConfidence ?? 0.70;

  if (localMatch && localMatch.confidence >= minLocalConfidence) {
    return { ...localMatch, source: "local" };
  }

  const transcript = localMatch?.matchedAlternative ?? alternatives[0] ?? "";
  if (!transcript.trim()) {
    return localMatch ? { ...localMatch, source: "local" } : null;
  }

  const commandLookup = new Map<string, Command>();
  for (const cmd of commands) {
    commandLookup.set(cmd.name, cmd);
    for (const pattern of cmd.patterns) {
      const normalized = normalizeTranscript(pattern);
      if (normalized) commandLookup.set(normalized, cmd);
    }
  }
  const availableCommands = Array.from(commandLookup.keys());

  const intentResolver =
    options.intentResolver ??
    ((input: string, knownCommands: string[], context) =>
      parseIntent(input, knownCommands, {
        alternatives: context.alternatives,
        commandCatalog: context.commandCatalog,
      }));

  let aiMatch: { command: string | null; confidence: number };
  try {
    aiMatch = await withTimeout(
      intentResolver(transcript, availableCommands, {
        alternatives,
        commandCatalog: buildCommandCatalog(),
      }),
      options.aiTimeoutMs ?? 2000
    );
  } catch {
    return localMatch ? { ...localMatch, source: "local" } : null;
  }
  const aiCommand = aiMatch.command
    ? commandLookup.get(normalizeTranscript(aiMatch.command)) ?? commandLookup.get(aiMatch.command)
    : null;

  if (aiCommand && aiMatch.confidence >= minAiConfidence) {
    return {
      command: aiCommand,
      confidence: aiMatch.confidence,
      matchedAlternative: transcript,
      source: "ai",
    };
  }

  return localMatch ? { ...localMatch, source: "local" } : null;
}

export function matchCommand(
  transcript: string
): { command: Command; confidence: number } | null {
  const input = normalizeTranscript(transcript);
  if (!input) return null;

  // Step 1 & 2 — Exact and substring matches (highest confidence)
  for (const { cmd, pattern } of patternIndex) {
    const normalizedPattern = normalizeTranscript(pattern);
    if (!normalizedPattern) continue;
    if (input === normalizedPattern) {
      return { command: cmd, confidence: 1.0 };
    }
    const boundaryRegex = new RegExp(
      `(^|\\s)${escapeRegex(normalizedPattern)}($|\\s)`
    );
    if (boundaryRegex.test(input)) {
      return { command: cmd, confidence: 0.95 };
    }
  }

  // Step 3 — Word-coverage: looks for key words of the pattern in input.
  // "please open the accessible reader now" → "open accessible reader"
  // pattern "open reader" → both words found → 0.86 confidence.
  let bestCoverage: { command: Command; confidence: number } | null = null;
  for (const { cmd, pattern } of patternIndex) {
    const score = wordCoverageScore(input, pattern);
    if (score > 0 && (!bestCoverage || score > bestCoverage.confidence)) {
      bestCoverage = { command: cmd, confidence: score };
    }
  }
  if (bestCoverage) return bestCoverage;

  // Step 4 — Levenshtein fuzzy fallback for ASR errors ("redder" → "reader").
  let bestFuzzy: Command | null = null;
  let bestScore = 0;

  for (const { cmd, pattern } of patternIndex) {
    const normalizedPattern = normalizeTranscript(pattern);
    const distance = levenshtein(input, normalizedPattern);
    const maxLen = Math.max(input.length, normalizedPattern.length);
    const similarity = maxLen > 0 ? 1 - distance / maxLen : 0;
    // Short commands need a higher threshold to prevent "soup" → "stop" etc.
    const threshold = normalizedPattern.length <= 4 ? 0.75 : 0.55;

    if (similarity > bestScore && similarity >= threshold) {
      bestScore = similarity;
      bestFuzzy = cmd;
    }
  }

  if (bestFuzzy) {
    return { command: bestFuzzy, confidence: bestScore };
  }

  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Intent resolver timed out")), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (err) => {
        clearTimeout(timeout);
        reject(err);
      }
    );
  });
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0) as number[]
  );

  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost
      );
    }
  }

  return dp[m]![n]!;
}
