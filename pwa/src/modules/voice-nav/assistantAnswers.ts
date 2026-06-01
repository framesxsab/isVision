/**
 * assistantAnswers — Conversational Q&A layer over the platform.
 *
 * The voice nav module dispatches *commands* ("open reader"). This module
 * answers *questions* ("what is this", "how do I use AI Vision"). It runs
 * AFTER the command matcher fails, so confident command hits still win.
 *
 * The intent matcher is intentionally simple (keyword + topic) so a blind
 * user can phrase questions naturally without learning a grammar. The
 * topics map to the same six modules a sighted user sees on Home.
 */

export type AssistantIntent =
  | "what_is_this"
  | "how_to_use"
  | "what_can_you_do"
  | "where_am_i"
  | "tour";

export type AssistantTopic =
  | "platform"
  | "touch-explorer"
  | "ai-vision"
  | "reader"
  | "voice-nav"
  | "tactile-output"
  | "tactile-drill"
  | "hardware-emulator"
  | "settings";

const topicAliases: Record<AssistantTopic, string[]> = {
  platform: ["isvisible", "this", "the app", "this app", "platform", "the platform"],
  "touch-explorer": ["touch explorer", "touch", "explorer", "touch mode"],
  "ai-vision": ["vision", "ai vision", "camera", "ai", "describe"],
  reader: ["reader", "accessible reader", "article", "read aloud"],
  "voice-nav": ["voice nav", "voice navigation", "voice commands", "commands"],
  "tactile-output": ["tactile output", "braille", "braille lab", "tactile lab"],
  "tactile-drill": ["tactile drill", "drill", "practice", "braille practice"],
  "hardware-emulator": ["hardware emulator", "emulator", "hardware", "display"],
  settings: ["settings", "preferences", "options"],
};

const intentKeywords: Array<{ intent: AssistantIntent; phrases: string[] }> = [
  // Order matters — first match wins. "what can you do" must beat "what is this".
  {
    intent: "tour",
    phrases: ["take a tour", "give me a tour", "show me around", "walk me through", "introduce yourself", "introduce", "tour"],
  },
  {
    intent: "what_can_you_do",
    phrases: ["what can you do", "what do you do", "what can i do here", "capabilities", "features"],
  },
  {
    intent: "how_to_use",
    phrases: ["how do i use", "how to use", "how does", "how do i", "how to", "explain how", "tell me how"],
  },
  {
    intent: "what_is_this",
    phrases: [
      "what is this",
      "what is",
      "what's this",
      "whats this",
      "tell me about",
      "describe this",
      "explain this",
      "explain",
      "describe",
      "about",
    ],
  },
  {
    intent: "where_am_i",
    phrases: ["where am i", "what page", "which page", "current page", "where"],
  },
];

const platformOverview =
  "isVisible is an accessibility platform for blind and low-vision people. " +
  "It has six tools: Touch Explorer lets you slide your finger to hear what's on screen. " +
  "AI Vision describes what the camera sees out loud. " +
  "Accessible Reader cleans up any web article and reads it to you. " +
  "Voice Navigation runs the whole app by voice. " +
  "Tactile Output Lab turns text into braille for refreshable displays. " +
  "Tactile Drill helps you practice braille. " +
  "You can always press F6, or tap the floating microphone, to talk to me.";

const topicDescriptions: Record<AssistantTopic, string> = {
  platform: platformOverview,
  "touch-explorer":
    "Touch Explorer turns your screen into an explorable surface. " +
    "Drag a finger anywhere and I will announce the element under it — buttons, links, headings, images. " +
    "Lifting your finger activates whatever you landed on. It works the same way as a screen reader's touch-exploration mode.",
  "ai-vision":
    "AI Vision uses the camera on your device to describe the world. " +
    "Point it at a room, a product, or a piece of text and I will speak a short description of what's there. " +
    "It's useful for identifying objects, reading signs, and getting a sense of your surroundings.",
  reader:
    "Accessible Reader takes any web page URL, strips away the ads and navigation, and reads the article aloud. " +
    "You can pause, resume, jump paragraphs, and change reading speed. " +
    "If you close the app mid-article, it remembers where you stopped.",
  "voice-nav":
    "Voice Navigation is the hands-free command center. " +
    "Press the large microphone button and speak a command like open reader, go home, faster, or stop. " +
    "It also lists every command available across the app.",
  "tactile-output":
    "Tactile Output Lab converts text into braille frames that you can send to a refreshable braille display, " +
    "or feel on a connected piezo cell. It supports grade 1 and grade 2 braille.",
  "tactile-drill":
    "Tactile Drill is a practice mode. It generates letters, words, and numbers in braille and tracks your accuracy " +
    "over time so you can build fluency.",
  "hardware-emulator":
    "The Hardware Emulator simulates a braille display on screen, so you can test tactile output without owning physical hardware.",
  settings:
    "Settings lets you change the speech voice, reading speed, high-contrast mode, and reset onboarding.",
};

const howToUse: Record<AssistantTopic, string> = {
  platform:
    "Start with the Workspace section on the home screen — pick any module and tap to open. " +
    "Or just say what you want: open reader, open camera, open touch explorer. Say help anytime for the full command list.",
  "touch-explorer":
    "Open Touch Explorer, then drag your finger across the screen. I will speak each element you touch. " +
    "Lift your finger to activate the element under it. Two-finger swipe right goes to the next element.",
  "ai-vision":
    "Open AI Vision, grant camera permission, then tap the capture button or say describe. " +
    "I will take a still frame and read a description back to you within a couple of seconds.",
  reader:
    "Open Accessible Reader, paste a URL, and press Read. Say play, pause, next, previous, faster, or slower " +
    "to control the reading.",
  "voice-nav":
    "Open Voice Navigation, press the big microphone, and speak. The help command reads back every available phrase.",
  "tactile-output":
    "Open Tactile Output Lab, type or paste text, and press Convert. You'll see and hear the braille frame breakdown. " +
    "If you have a braille display connected via Web HID, it can be sent there directly.",
  "tactile-drill":
    "Open Tactile Drill and pick a difficulty. I will speak a target — type the braille dot pattern that matches. " +
    "Your accuracy is tracked across sessions.",
  "hardware-emulator":
    "Open Hardware Emulator. You'll see a virtual braille display. Send any text to it from Tactile Output Lab " +
    "to see how it would render on real hardware.",
  settings:
    "Open Settings to change voice, speed, or visual contrast. Reset onboarding from the bottom of that page.",
};

const pageLabels: Record<string, string> = {
  "/": "the home screen",
  "/settings": "Settings",
  "/onboarding": "the onboarding tour",
  "/troubleshoot": "the troubleshooting page",
  "/touch-explorer": "Touch Explorer",
  "/ai-vision": "AI Vision",
  "/reader": "Accessible Reader",
  "/voice-nav": "Voice Navigation",
  "/tactile-output": "the Tactile Output Lab",
  "/tactile-drill": "Tactile Drill",
  "/hardware-emulator": "the Hardware Emulator",
};

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[.,!?;:'"()\-_/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectIntent(input: string): AssistantIntent | null {
  for (const { intent, phrases } of intentKeywords) {
    for (const phrase of phrases) {
      if (input.includes(phrase)) return intent;
    }
  }
  return null;
}

/**
 * If the entire utterance is one or two words and matches a topic alias
 * exactly, return it. Used for "reader" / "vision" voice fragments where
 * the user clearly meant a topic but didn't form a sentence.
 */
function detectBareTopic(input: string): AssistantTopic | null {
  const words = input.split(" ").filter(Boolean);
  if (words.length === 0 || words.length > 3) return null;
  for (const [topic, aliases] of Object.entries(topicAliases) as Array<
    [AssistantTopic, string[]]
  >) {
    for (const alias of aliases) {
      if (input === alias) return topic;
    }
  }
  return null;
}

function detectTopic(input: string, fallback: AssistantTopic): AssistantTopic {
  // Longest alias first so "touch explorer" beats "touch".
  const flat: Array<{ topic: AssistantTopic; alias: string }> = [];
  for (const [topic, aliases] of Object.entries(topicAliases) as Array<
    [AssistantTopic, string[]]
  >) {
    for (const alias of aliases) flat.push({ topic, alias });
  }
  flat.sort((a, b) => b.alias.length - a.alias.length);

  for (const { topic, alias } of flat) {
    if (input.includes(alias)) return topic;
  }
  return fallback;
}

/** Map the current route to the topic the user is most likely asking about. */
export function topicForRoute(pathname: string): AssistantTopic {
  switch (pathname) {
    case "/touch-explorer":
      return "touch-explorer";
    case "/ai-vision":
      return "ai-vision";
    case "/reader":
      return "reader";
    case "/voice-nav":
      return "voice-nav";
    case "/tactile-output":
      return "tactile-output";
    case "/tactile-drill":
      return "tactile-drill";
    case "/hardware-emulator":
      return "hardware-emulator";
    case "/settings":
      return "settings";
    default:
      return "platform";
  }
}

export interface AssistantAnswer {
  intent: AssistantIntent;
  topic: AssistantTopic;
  spoken: string;
}

/**
 * Try to answer a free-form question about the platform.
 * Returns null if the input doesn't look like a question we can handle —
 * the caller should fall back to "I didn't understand".
 */
export function answerQuestion(
  transcript: string,
  pathname: string
): AssistantAnswer | null {
  const input = normalize(transcript);
  if (!input) return null;

  let intent = detectIntent(input);
  const contextualTopic = topicForRoute(pathname);

  // Bare-keyword fallback: if the user says just "reader" or "vision" with
  // no intent verb, treat it as "tell me about reader". This makes the
  // assistant tolerant of one-word voice captures, which are common when
  // the browser cuts speech short or the user is hesitant.
  if (!intent) {
    const bareTopic = detectBareTopic(input);
    if (bareTopic) {
      return {
        intent: "what_is_this",
        topic: bareTopic,
        spoken: topicDescriptions[bareTopic],
      };
    }
    return null;
  }

  const topic = detectTopic(input, contextualTopic);

  let spoken: string;
  switch (intent) {
    case "tour":
      spoken = platformOverview;
      break;
    case "what_can_you_do":
      spoken =
        "I can open any module by voice — say open reader, open camera, open touch explorer, open voice nav, " +
        "open tactile lab, or open drill. I can also describe the platform: ask what is this, or how do I use any module. " +
        "Say help to hear every command.";
      break;
    case "how_to_use":
      spoken = howToUse[topic];
      break;
    case "what_is_this":
      spoken = topicDescriptions[topic];
      break;
    case "where_am_i":
      spoken = `You're on ${pageLabels[pathname] ?? pathname}.`;
      break;
  }

  return { intent, topic, spoken };
}

export { platformOverview };
