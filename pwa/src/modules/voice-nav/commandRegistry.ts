/**
 * Command Registry — Maps voice commands to actions.
 * Uses pattern matching with fuzzy matching fallback.
 */

export interface Command {
  name: string;
  patterns: string[];
  description: string;
  module: string;
  action: string; // Action identifier dispatched to the app
}

export const commands: Command[] = [
  // Global commands
  {
    name: "help",
    patterns: ["help", "what can i do", "commands", "list commands"],
    description: "List available voice commands",
    module: "global",
    action: "help",
  },
  {
    name: "go_home",
    patterns: ["go home", "home", "main menu", "back to home"],
    description: "Go to the home screen",
    module: "global",
    action: "navigate_home",
  },
  {
    name: "go_back",
    patterns: ["go back", "back", "previous page"],
    description: "Go back to the previous page",
    module: "global",
    action: "navigate_back",
  },
  {
    name: "stop",
    patterns: ["stop", "be quiet", "silence", "shut up", "quiet"],
    description: "Stop speaking",
    module: "global",
    action: "stop_speech",
  },
  {
    name: "repeat",
    patterns: ["repeat", "say again", "what did you say", "repeat that"],
    description: "Repeat the last spoken text",
    module: "global",
    action: "repeat",
  },
  {
    name: "settings",
    patterns: ["settings", "preferences", "options", "open settings"],
    description: "Open settings",
    module: "global",
    action: "navigate_settings",
  },

  // Touch Explorer commands
  {
    name: "open_explorer",
    patterns: ["touch explorer", "explore", "open explorer", "touch mode"],
    description: "Open Touch Explorer",
    module: "touch-explorer",
    action: "navigate_touch_explorer",
  },

  // AI Vision commands
  {
    name: "open_vision",
    patterns: ["camera", "vision", "open camera", "ai vision", "what do you see", "describe"],
    description: "Open AI Vision",
    module: "ai-vision",
    action: "navigate_ai_vision",
  },
  {
    name: "capture",
    patterns: ["capture", "take photo", "take picture", "snap", "describe what you see", "what is this"],
    description: "Capture and describe image",
    module: "ai-vision",
    action: "capture_image",
  },

  // Reader commands
  {
    name: "open_reader",
    patterns: ["reader", "read", "open reader", "accessible reader"],
    description: "Open Accessible Reader",
    module: "reader",
    action: "navigate_reader",
  },
  {
    name: "open_tactile_output",
    patterns: ["tactile output", "braille lab", "tactile lab", "open braille"],
    description: "Open Tactile Output Lab",
    module: "tactile-output",
    action: "navigate_tactile_output",
  },
  {
    name: "open_tactile_drill",
    patterns: ["tactile drill", "drill", "practice braille", "braille drill", "open drill"],
    description: "Open Tactile Drill",
    module: "tactile-output",
    action: "navigate_tactile_drill",
  },
  {
    name: "play",
    patterns: ["play", "start reading", "read aloud", "read this"],
    description: "Start or resume reading",
    module: "reader",
    action: "reader_play",
  },
  {
    name: "pause",
    patterns: ["pause", "pause reading", "wait"],
    description: "Pause reading",
    module: "reader",
    action: "reader_pause",
  },
  {
    name: "next",
    patterns: ["next", "next paragraph", "skip", "next section"],
    description: "Skip to next paragraph",
    module: "reader",
    action: "reader_next",
  },
  {
    name: "previous",
    patterns: ["previous", "go back", "previous paragraph", "back one"],
    description: "Go to previous paragraph",
    module: "reader",
    action: "reader_previous",
  },
  {
    name: "faster",
    patterns: ["faster", "speed up", "increase speed"],
    description: "Increase reading speed",
    module: "reader",
    action: "speed_up",
  },
  {
    name: "slower",
    patterns: ["slower", "slow down", "decrease speed"],
    description: "Decrease reading speed",
    module: "reader",
    action: "slow_down",
  },
];

// Filler words to strip before matching. "please open the camera now" should
// match "open camera" just as well as the literal phrase. We do this after
// lowercasing and punctuation stripping, then collapse multiple spaces.
const FILLER_WORDS = new Set([
  "please", "the", "a", "an", "to", "now", "ok", "okay", "hey", "um", "uh",
  "could", "would", "can", "you", "for", "me", "i", "want", "need", "let",
  "us", "lets",
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

// Precomputed list of (pattern, command) pairs sorted longest-first so the
// more specific phrase wins when a transcript contains multiple shorter
// patterns (e.g. "go home" beats "home", "previous paragraph" beats "previous").
const patternIndex = commands
  .flatMap((cmd) => cmd.patterns.map((pattern) => ({ cmd, pattern })))
  .sort((a, b) => b.pattern.length - a.pattern.length);

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
      // A confident exact match in any alternative is good enough — stop.
      if (result.confidence >= 1.0) return best;
    }
  }

  return best;
}

/**
 * Find the best matching command for a single transcript.
 * Pipeline: normalize → longest-pattern exact/substring → Levenshtein fuzzy.
 */
export function matchCommand(
  transcript: string
): { command: Command; confidence: number } | null {
  const input = normalizeTranscript(transcript);
  if (!input) return null;

  // Exact / substring match against the longest-first index. Whole-word
  // matching avoids false positives like "stop" matching inside "stoplight".
  for (const { cmd, pattern } of patternIndex) {
    if (input === pattern) {
      return { command: cmd, confidence: 1.0 };
    }
    // Word-boundary check so "back" doesn't match inside "background".
    const boundaryRegex = new RegExp(
      `(^|\\s)${escapeRegex(pattern)}($|\\s)`
    );
    if (boundaryRegex.test(input)) {
      return { command: cmd, confidence: 0.95 };
    }
  }

  // Fuzzy match using Levenshtein distance — threshold scales with length
  // so short commands (3-4 chars) aren't matched against unrelated noise.
  let bestMatch: Command | null = null;
  let bestScore = 0;

  for (const { cmd, pattern } of patternIndex) {
    const distance = levenshtein(input, pattern);
    const maxLen = Math.max(input.length, pattern.length);
    const similarity = maxLen > 0 ? 1 - distance / maxLen : 0;
    // Short patterns need a higher bar so a 1-edit mismatch on a 4-char word
    // doesn't sneak through (e.g. "soup" → "stop").
    const threshold = pattern.length <= 4 ? 0.8 : 0.65;

    if (similarity > bestScore && similarity >= threshold) {
      bestScore = similarity;
      bestMatch = cmd;
    }
  }

  if (bestMatch) {
    return { command: bestMatch, confidence: bestScore };
  }

  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
