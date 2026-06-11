import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NavigateFunction } from "react-router-dom";

const { speechEngineMock, settingsStoreState } = vi.hoisted(() => ({
  speechEngineMock: {
    interrupt: vi.fn(),
    stop: vi.fn(),
    repeatLast: vi.fn(),
    setRate: vi.fn(),
  },
  settingsStoreState: {
    speechRate: 1,
    setSpeechRate: vi.fn(),
  },
}));

vi.mock("@/core/audio/SpeechEngine", () => ({
  speechEngine: speechEngineMock,
}));

vi.mock("@/core/store/settingsStore", () => ({
  useSettingsStore: {
    getState: () => settingsStoreState,
  },
}));

import {
  MODULE_VOICE_ACTION_EVENT,
  changeReaderSpeed,
  runVoiceAction,
  takePendingVoiceAction,
} from "./voiceActions";

function stubSessionStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runVoiceAction", () => {
  let navigate: NavigateFunction;

  beforeEach(() => {
    navigate = vi.fn() as unknown as NavigateFunction;
    vi.clearAllMocks();
    settingsStoreState.speechRate = 1;
  });

  it("navigates to voice navigation from any voice entry point", () => {
    expect(
      runVoiceAction({
        action: "navigate_voice_nav",
        navigate,
        pathname: "/reader",
      })
    ).toBe(true);

    expect(navigate).toHaveBeenCalledWith("/voice-nav");
  });

  it("emits reader module actions when already on the reader page", () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });

    expect(
      runVoiceAction({
        action: "reader_next",
        navigate,
        pathname: "/reader",
      })
    ).toBe(true);

    expect(dispatchEvent).toHaveBeenCalledTimes(1);
    expect(dispatchEvent.mock.calls[0]?.[0]).toMatchObject({
      type: MODULE_VOICE_ACTION_EVENT,
      detail: { action: "reader_next" },
    });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("opens the owning module and records a pending action when spoken elsewhere", () => {
    stubSessionStorage();

    expect(
      runVoiceAction({
        action: "capture_image",
        navigate,
        pathname: "/",
      })
    ).toBe(true);

    expect(navigate).toHaveBeenCalledWith("/ai-vision");
    expect(speechEngineMock.interrupt).toHaveBeenCalledWith(
      "Opening the module for that command.",
      { remember: false }
    );
    expect(takePendingVoiceAction("/ai-vision")).toBe("capture_image");
    expect(takePendingVoiceAction("/ai-vision")).toBeNull();
  });

  it("does not consume a pending module action on the wrong route", () => {
    stubSessionStorage();

    runVoiceAction({
      action: "reader_next",
      navigate,
      pathname: "/",
    });

    expect(takePendingVoiceAction("/ai-vision")).toBeNull();
    expect(takePendingVoiceAction("/reader")).toBe("reader_next");
  });

  it("queues tactile drill actions for the drill route", () => {
    stubSessionStorage();

    expect(
      runVoiceAction({
        action: "drill_repeat",
        navigate,
        pathname: "/",
      })
    ).toBe(true);

    expect(navigate).toHaveBeenCalledWith("/tactile-drill");
    expect(takePendingVoiceAction("/tactile-drill")).toBe("drill_repeat");
  });
});

describe("changeReaderSpeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    settingsStoreState.speechRate = 1;
  });

  it("updates store and speech engine with a clamped rate", () => {
    expect(changeReaderSpeed(5)).toBe(3);
    expect(settingsStoreState.setSpeechRate).toHaveBeenCalledWith(3);
    expect(speechEngineMock.setRate).toHaveBeenCalledWith(3);
  });
});
