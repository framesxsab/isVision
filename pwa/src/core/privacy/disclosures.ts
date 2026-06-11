// Privacy disclosures rendered in the Settings panel.
//
// Each entry is a small data record so the renderer doesn't have to make
// editorial judgements at display time — adding a new place the app touches
// data means appending a row here, not editing JSX.
//
// Scopes are deliberately blunt:
//   - "local"      → never leaves the device
//   - "system"     → handed to the host OS (e.g. system TTS)
//   - "server"     → leaves the device for our same-origin API
//   - "third-party"→ leaves the device for an external provider (via our
//                    server or the browser's own bridge)

export type Scope = "local" | "system" | "server" | "third-party";

export interface Disclosure {
  id: string;
  title: string;
  /** Scope chip — colour-coded in the UI. */
  scope: Scope;
  /** One-line summary shown next to the chip. */
  summary: string;
  /** Longer explanation revealed inside the <details> element. */
  detail: string;
}

export const SCOPE_LABELS: Record<Scope, string> = {
  local: "Stays on this device",
  system: "Handed to your OS",
  server: "Goes to our server",
  "third-party": "Goes to a third party",
};

export const SCOPE_CLASSES: Record<Scope, string> = {
  local: "bg-green-900/40 text-green-200 border-green-700",
  system: "bg-blue-900/40 text-blue-200 border-blue-700",
  server: "bg-yellow-900/40 text-yellow-200 border-yellow-700",
  "third-party": "bg-red-900/40 text-red-200 border-red-700",
};

export const DISCLOSURES: Disclosure[] = [
  {
    id: "clipboard",
    title: "Clipboard",
    scope: "local",
    summary: "Only read or written when you press a Copy or Paste button.",
    detail:
      "The Tactile Lab reads from your clipboard the moment you click Paste, and writes to it only when you click Copy. There is no background polling and no copying happens without a button press.",
  },
  {
    id: "files-and-text",
    title: "Uploaded files and typed text",
    scope: "local",
    summary: "Files are read in your browser. Nothing is uploaded.",
    detail:
      "Picking a .txt or .md file runs it through the in-page File API and lands the contents in the Tactile Lab textarea. The file never leaves your device. Typing into the textarea also stays local.",
  },
  {
    id: "persisted-state",
    title: "Saved settings and drill progress",
    scope: "local",
    summary: "Stored in your browser via localStorage. You can clear it any time.",
    detail:
      "Your translator/language/output settings and drill score live in localStorage under the keys isvisible-settings and isvisible-tactile. Imported Tactile Lab text is saved there only if you turn on Remember Tactile Lab imports across restarts. Clearing site data in your browser removes both keys.",
  },
  {
    id: "speech-output",
    title: "Speech output",
    scope: "system",
    summary: "Uses your operating system's text-to-speech engine.",
    detail:
      "We pass text to the browser's speechSynthesis API, which the OS turns into audio. Whether the engine is local or cloud-backed depends on your OS and the voice you've chosen — that part is outside our control.",
  },
  {
    id: "voice-input",
    title: "Voice commands (microphone)",
    scope: "third-party",
    summary: "Audio is sent to your browser's speech service while listening.",
    detail:
      "When you activate voice commands, the Web Speech API streams audio to a recognition service (in Chrome this is Google's). The resulting transcript is then sent to our server only to match it against the command list. Recognition stops as soon as you stop talking.",
  },
  {
    id: "ai-vision",
    title: "AI Vision",
    scope: "third-party",
    summary: "Camera frames are sent to our server, which calls an AI provider.",
    detail:
      "When you tap the capture button in AI Vision, the still frame is base64-encoded and POSTed to our /api/vision/describe endpoint, which forwards it to the configured vision model (NVIDIA NIM). Frames are not stored on our server beyond the duration of the request.",
  },
  {
    id: "reader-fetch",
    title: "Reader",
    scope: "server",
    summary: "Article URLs are fetched by our server, not your browser.",
    detail:
      "Pasting a URL in Accessible Reader sends just the URL to /api/reader/fetch. Our server fetches the page (refusing private/link-local IPs to block SSRF), strips cookies, caps the body size, and returns the cleaned HTML. The destination site sees a request from our server, not from you.",
  },
  {
    id: "hardware-bridges",
    title: "Serial and HID braille displays",
    scope: "local",
    summary: "Data goes only to the device you pick. Nothing is uploaded.",
    detail:
      "Web Serial and WebHID require you to pick a device every session. Frame data is written directly to that device over USB. No copy is sent anywhere else; we don't see what your hardware receives.",
  },
];
