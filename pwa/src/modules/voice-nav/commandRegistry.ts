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

/**
 * Find the best matching command for a transcript.
 * Uses case-insensitive substring matching, then Levenshtein distance.
 */
export function matchCommand(
  transcript: string
): { command: Command; confidence: number } | null {
  const input = transcript.toLowerCase().trim();

  // Exact/substring match
  for (const cmd of commands) {
    for (const pattern of cmd.patterns) {
      if (input === pattern || input.includes(pattern)) {
        return { command: cmd, confidence: 1.0 };
      }
    }
  }

  // Fuzzy match using Levenshtein distance
  let bestMatch: Command | null = null;
  let bestScore = 0;

  for (const cmd of commands) {
    for (const pattern of cmd.patterns) {
      const distance = levenshtein(input, pattern);
      const maxLen = Math.max(input.length, pattern.length);
      const similarity = maxLen > 0 ? 1 - distance / maxLen : 0;

      if (similarity > bestScore && similarity > 0.6) {
        bestScore = similarity;
        bestMatch = cmd;
      }
    }
  }

  if (bestMatch) {
    return { command: bestMatch, confidence: bestScore };
  }

  return null;
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
