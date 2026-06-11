// Detection helpers for browser/host capabilities the tactile pipeline relies
// on. Centralizing these here keeps the UI from having to know which global
// to probe — and gives us one place to add fallback advice when a feature
// isn't available.
//
// Every function is a pure read of globals so callers can render them at
// any time (e.g. in a useMemo on mount) without worrying about side effects.

export type CapabilityId =
  | "camera"
  | "microphone"
  | "web-serial"
  | "web-hid"
  | "clipboard-read"
  | "clipboard-write"
  | "speech-synthesis"
  | "speech-recognition"
  | "vibration"
  | "service-worker"
  | "cache-storage";

export interface CapabilityReport {
  available: boolean;
  /** Short user-facing reason when unavailable. Empty when available. */
  reason: string;
  /** Concrete next step the user can take when unavailable. */
  suggestion: string;
}

export type MediaPermissionKind = "camera" | "microphone";
export type BrowserPermissionState = "unknown" | "granted" | "denied";

// Each detector returns a CapabilityReport instead of a raw boolean so the UI
// can render a meaningful "X is unavailable because Y. Try Z." line without
// duplicating that copy in every consumer.

const CHROMIUM_FAMILY_HINT =
  "Chromium browsers (Chrome, Edge, Opera) over HTTPS or localhost.";

// We test for a truthy value rather than `"key" in navigator` because tests
// (and some polyfills) defineProperty(navigator, key, { value: undefined }),
// which leaves the key in the object but with no actual API behind it.

export function detectCamera(): CapabilityReport {
  const mediaDevices =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices
      : undefined;
  if (mediaDevices?.getUserMedia) {
    return { available: true, reason: "", suggestion: "" };
  }
  return {
    available: false,
    reason: "Camera capture is not available in this browser context.",
    suggestion:
      "Open the app over HTTPS or localhost, then allow camera access from the browser prompt.",
  };
}

export function detectMicrophone(): CapabilityReport {
  const mediaDevices =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { mediaDevices?: MediaDevices }).mediaDevices
      : undefined;
  if (mediaDevices?.getUserMedia) {
    return { available: true, reason: "", suggestion: "" };
  }
  return {
    available: false,
    reason: "Microphone capture is not available in this browser context.",
    suggestion:
      "Open the app over HTTPS or localhost, then allow microphone access for voice navigation.",
  };
}

export function detectWebSerial(): CapabilityReport {
  const serial = typeof navigator !== "undefined" ? (navigator as Navigator & { serial?: unknown }).serial : undefined;
  if (serial) {
    return { available: true, reason: "", suggestion: "" };
  }
  return {
    available: false,
    reason: "Web Serial is not available in this browser.",
    suggestion: `Use ${CHROMIUM_FAMILY_HINT} You can still export frames to a file and pipe them with tools/tactile_serve.py.`,
  };
}

export function detectWebHid(): CapabilityReport {
  const hid = typeof navigator !== "undefined" ? (navigator as Navigator & { hid?: unknown }).hid : undefined;
  if (hid) {
    return { available: true, reason: "", suggestion: "" };
  }
  return {
    available: false,
    reason: "WebHID is not available in this browser.",
    suggestion: `Use ${CHROMIUM_FAMILY_HINT} Firefox and Safari don't expose WebHID at all.`,
  };
}

export function detectClipboardRead(): CapabilityReport {
  const clipboard = (typeof navigator !== "undefined" ? navigator.clipboard : undefined) as
    | (Clipboard & { readText?: () => Promise<string> })
    | undefined;
  if (clipboard?.readText) {
    return { available: true, reason: "", suggestion: "" };
  }
  return {
    available: false,
    reason: "Clipboard read is not exposed by this browser.",
    suggestion:
      "Paste directly into the textarea below, or upload the text as a .txt or .md file.",
  };
}

export function detectClipboardWrite(): CapabilityReport {
  const clipboard = (typeof navigator !== "undefined" ? navigator.clipboard : undefined) as
    | (Clipboard & { writeText?: (text: string) => Promise<void> })
    | undefined;
  if (clipboard?.writeText) {
    return { available: true, reason: "", suggestion: "" };
  }
  return {
    available: false,
    reason: "Clipboard write is not exposed by this browser.",
    suggestion: "Select the output text manually with Ctrl+A and copy with Ctrl+C.",
  };
}

export function detectSpeechSynthesis(): CapabilityReport {
  const synth =
    typeof window !== "undefined"
      ? (window as Window & { speechSynthesis?: unknown }).speechSynthesis
      : undefined;
  if (synth) {
    return { available: true, reason: "", suggestion: "" };
  }
  return {
    available: false,
    reason: "Speech synthesis is unavailable.",
    suggestion:
      "Enable a system text-to-speech engine, or use the on-screen output for navigation.",
  };
}

export function detectSpeechRecognition(): CapabilityReport {
  const w = typeof window !== "undefined" ? (window as unknown as Record<string, unknown>) : null;
  const has = Boolean(w && (w.SpeechRecognition || w.webkitSpeechRecognition));
  if (has) return { available: true, reason: "", suggestion: "" };
  return {
    available: false,
    reason: "Speech recognition is not available in this browser.",
    suggestion: "Use the on-screen controls. Voice commands need Chrome, Edge, or Safari.",
  };
}

export function detectVibration(): CapabilityReport {
  const vibrate =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { vibrate?: unknown }).vibrate
      : undefined;
  if (typeof vibrate === "function") {
    return { available: true, reason: "", suggestion: "" };
  }
  return {
    available: false,
    reason: "Vibration feedback is not available on this device or browser.",
    suggestion:
      "Use speech and spatial audio cues. Many desktop browsers do not expose vibration.",
  };
}

export function detectServiceWorker(): CapabilityReport {
  const serviceWorker =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { serviceWorker?: unknown }).serviceWorker
      : undefined;
  if (serviceWorker) {
    return { available: true, reason: "", suggestion: "" };
  }
  return {
    available: false,
    reason: "Service workers are not available in this browser context.",
    suggestion:
      "Install or open the app over HTTPS or localhost so offline app-shell caching can work.",
  };
}

export function detectCacheStorage(): CapabilityReport {
  const cachesApi =
    typeof globalThis !== "undefined"
      ? (globalThis as typeof globalThis & { caches?: unknown }).caches
      : undefined;
  if (cachesApi) {
    return { available: true, reason: "", suggestion: "" };
  }
  return {
    available: false,
    reason: "Cache Storage is not available in this browser context.",
    suggestion:
      "Use HTTPS or localhost and avoid private browsing modes that block offline storage.",
  };
}

const DETECTORS: Record<CapabilityId, () => CapabilityReport> = {
  camera: detectCamera,
  microphone: detectMicrophone,
  "web-serial": detectWebSerial,
  "web-hid": detectWebHid,
  "clipboard-read": detectClipboardRead,
  "clipboard-write": detectClipboardWrite,
  "speech-synthesis": detectSpeechSynthesis,
  "speech-recognition": detectSpeechRecognition,
  vibration: detectVibration,
  "service-worker": detectServiceWorker,
  "cache-storage": detectCacheStorage,
};

export function detectCapability(id: CapabilityId): CapabilityReport {
  return DETECTORS[id]();
}

export async function queryMediaPermission(
  kind: MediaPermissionKind
): Promise<BrowserPermissionState | null> {
  const permissions =
    typeof navigator !== "undefined"
      ? (navigator as Navigator & { permissions?: Permissions }).permissions
      : undefined;

  if (!permissions?.query) return null;

  try {
    const status = await permissions.query({ name: kind as PermissionName });
    if (status.state === "granted") return "granted";
    if (status.state === "denied") return "denied";
    return "unknown";
  } catch {
    return null;
  }
}
