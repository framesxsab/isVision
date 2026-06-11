import type { NavigateFunction } from "react-router-dom";
import { speechEngine } from "@/core/audio/SpeechEngine";
import { useSettingsStore } from "@/core/store/settingsStore";

export type VoiceAction =
  | "capture_image"
  | "reader_play"
  | "reader_pause"
  | "reader_next"
  | "reader_previous"
  | "speed_up"
  | "slow_down"
  | "drill_next"
  | "drill_previous"
  | "drill_repeat"
  | "drill_reset";

export const MODULE_VOICE_ACTION_EVENT = "isvisible:voice-action";
const PENDING_VOICE_ACTION_KEY = "isvisible:pending-voice-action";

const NAV_ACTIONS: Record<string, string> = {
  navigate_home: "/",
  navigate_settings: "/settings",
  navigate_touch_explorer: "/touch-explorer",
  navigate_ai_vision: "/ai-vision",
  navigate_reader: "/reader",
  navigate_tactile_output: "/tactile-output",
  navigate_tactile_drill: "/tactile-drill",
  navigate_voice_nav: "/voice-nav",
};

const MODULE_ACTION_ROUTES: Partial<Record<VoiceAction, string>> = {
  capture_image: "/ai-vision",
  reader_play: "/reader",
  reader_pause: "/reader",
  reader_next: "/reader",
  reader_previous: "/reader",
  speed_up: "/reader",
  slow_down: "/reader",
  drill_next: "/tactile-drill",
  drill_previous: "/tactile-drill",
  drill_repeat: "/tactile-drill",
  drill_reset: "/tactile-drill",
};

function emitModuleAction(action: VoiceAction) {
  window.dispatchEvent(
    new CustomEvent<{ action: VoiceAction }>(MODULE_VOICE_ACTION_EVENT, {
      detail: { action },
    })
  );
}

function isVoiceAction(action: string): action is VoiceAction {
  return action in MODULE_ACTION_ROUTES;
}

function rememberPendingModuleAction(action: VoiceAction) {
  try {
    sessionStorage.setItem(
      PENDING_VOICE_ACTION_KEY,
      JSON.stringify({ action, createdAt: Date.now() })
    );
  } catch {
    // Storage can be blocked. Navigation still proceeds; the user can repeat
    // the command on the destination page.
  }
}

export function takePendingVoiceAction(pathname: string): VoiceAction | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(PENDING_VOICE_ACTION_KEY);
  } catch {
    return null;
  }

  if (!raw) return null;

  let parsed: { action?: string; createdAt?: number };
  try {
    parsed = JSON.parse(raw) as { action?: string; createdAt?: number };
  } catch {
    sessionStorage.removeItem(PENDING_VOICE_ACTION_KEY);
    return null;
  }

  const action = parsed.action;
  const ageMs = Date.now() - (parsed.createdAt ?? 0);
  if (!action || !isVoiceAction(action) || ageMs > 10_000) {
    sessionStorage.removeItem(PENDING_VOICE_ACTION_KEY);
    return null;
  }

  if (MODULE_ACTION_ROUTES[action] !== pathname) return null;
  sessionStorage.removeItem(PENDING_VOICE_ACTION_KEY);
  return action;
}

export function runVoiceAction({
  action,
  navigate,
  pathname,
  silent = false,
}: {
  action: string;
  navigate: NavigateFunction;
  pathname: string;
  silent?: boolean;
}): boolean {
  const say = (message: string) => {
    if (!silent) speechEngine.interrupt(message, { remember: false });
  };

  const path = NAV_ACTIONS[action];
  if (path) {
    navigate(path);
    say(path === "/" ? "Going home." : "Opening page.");
    return true;
  }

  if (action === "navigate_back") {
    navigate(-1);
    say("Going back.");
    return true;
  }

  if (action === "stop_speech") {
    speechEngine.stop();
    return true;
  }

  if (action === "repeat") {
    const repeated = speechEngine.repeatLast();
    if (!repeated) say("There is nothing to repeat yet.");
    return true;
  }

  if (action === "help") {
    say(
      "Press F6 to speak a command. Say open reader, open camera, open tactile lab, open drill, open voice nav, settings, go home, or stop."
    );
    return true;
  }

  const moduleRoute = MODULE_ACTION_ROUTES[action as VoiceAction];
  if (moduleRoute) {
    if (pathname === moduleRoute) {
      emitModuleAction(action as VoiceAction);
      return true;
    }
    rememberPendingModuleAction(action as VoiceAction);
    navigate(moduleRoute);
    say("Opening the module for that command.");
    return true;
  }

  return false;
}

export function changeReaderSpeed(delta: number): number {
  const store = useSettingsStore.getState();
  const next = Math.max(0.5, Math.min(3, store.speechRate + delta));
  store.setSpeechRate(next);
  speechEngine.setRate(next);
  return next;
}
