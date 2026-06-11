import { afterEach, describe, expect, it, vi } from "vitest";
import { createSpeechEngineForTest } from "./SpeechEngine";

// Minimal fake of SpeechSynthesisUtterance — captures the text and exposes
// the lifecycle hooks so tests can drive the queue forward manually.
class FakeUtterance {
  text: string;
  rate = 1;
  pitch = 1;
  volume = 1;
  voice: unknown = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

interface FakeSynth {
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  getVoices: ReturnType<typeof vi.fn>;
}

function makeSynth(): FakeSynth {
  return {
    speak: vi.fn(),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn(() => []),
  };
}

function stubSpeech(synth: FakeSynth) {
  vi.stubGlobal("window", { speechSynthesis: synth });
  vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
}

// Pull the FakeUtterance handed to synth.speak on the Nth call. Wrapping
// the indexed access keeps the test bodies free of `!`-assertions and gives
// a useful failure message if a call we expected didn't happen.
function getUtterance(synth: FakeSynth, index: number): FakeUtterance {
  const call = synth.speak.mock.calls[index];
  if (!call) throw new Error(`No synth.speak call at index ${index}`);
  return call[0] as FakeUtterance;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SpeechEngine", () => {
  it("hands a single queued utterance to the synth", () => {
    const synth = makeSynth();
    stubSpeech(synth);
    const engine = createSpeechEngineForTest();

    engine.speak("hello");

    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(getUtterance(synth, 0).text).toBe("hello");
    expect(engine.speaking).toBe(true);
  });

  it("priority 'user' cancels any in-flight speech before queueing", () => {
    const synth = makeSynth();
    stubSpeech(synth);
    const engine = createSpeechEngineForTest();

    engine.speak("status update");
    engine.speak("user action", { priority: "user" });

    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(getUtterance(synth, 1).text).toBe("user action");
  });

  it("interrupt() is sugar for priority 'user'", () => {
    const synth = makeSynth();
    stubSpeech(synth);
    const engine = createSpeechEngineForTest();

    engine.speak("first");
    engine.interrupt("urgent");

    expect(synth.cancel).toHaveBeenCalledTimes(1);
    expect(getUtterance(synth, 1).text).toBe("urgent");
  });

  it("repeatLast() replays the most recent utterance", () => {
    const synth = makeSynth();
    stubSpeech(synth);
    const engine = createSpeechEngineForTest();

    engine.speak("hello");

    expect(engine.repeatLast()).toBe(true);
    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(getUtterance(synth, 1).text).toBe("hello");
  });

  it("does not replace repeat memory when remember is false", () => {
    const synth = makeSynth();
    stubSpeech(synth);
    const engine = createSpeechEngineForTest();

    engine.speak("content to repeat");
    engine.interrupt("Listening.", { remember: false });

    expect(engine.repeatLast()).toBe(true);
    expect(getUtterance(synth, 2).text).toBe("content to repeat");
  });

  it("default-priority speak queues behind the currently-playing utterance", () => {
    const synth = makeSynth();
    stubSpeech(synth);
    const engine = createSpeechEngineForTest();

    engine.speak("first");
    engine.speak("second"); // status priority — must wait its turn

    // Synth has only seen the first utterance so far.
    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(synth.cancel).not.toHaveBeenCalled();

    // Drive the first to completion; the queue should pump the next one.
    getUtterance(synth, 0).onend?.();

    expect(synth.speak).toHaveBeenCalledTimes(2);
    expect(getUtterance(synth, 1).text).toBe("second");
  });

  it("keeps per-speech end callbacks scoped to their own queued text", () => {
    const synth = makeSynth();
    stubSpeech(synth);
    const engine = createSpeechEngineForTest();
    const firstDone = vi.fn();
    const secondDone = vi.fn();

    engine.speak("first", { onEnd: firstDone });
    engine.speak("second", { onEnd: secondDone });

    getUtterance(synth, 0).onend?.();

    expect(firstDone).toHaveBeenCalledTimes(1);
    expect(secondDone).not.toHaveBeenCalled();

    getUtterance(synth, 1).onend?.();

    expect(secondDone).toHaveBeenCalledTimes(1);
  });

  it("fires a per-speech end callback only after the final chunk", () => {
    const synth = makeSynth();
    stubSpeech(synth);
    const engine = createSpeechEngineForTest();
    const onEnd = vi.fn();
    const longText = (
      "First sentence is moderately long. " +
      "Second sentence is also moderately long. " +
      "Third sentence finishes the paragraph nicely. "
    ).repeat(3);

    engine.speak(longText, { onEnd });
    getUtterance(synth, 0).onend?.();

    expect(onEnd).not.toHaveBeenCalled();

    while (synth.speak.mock.calls.length > onEnd.mock.calls.length + 1) {
      const lastIndex = synth.speak.mock.calls.length - 1;
      getUtterance(synth, lastIndex).onend?.();
      if (onEnd.mock.calls.length > 0) break;
    }

    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it("chunks text past the 200-char limit into multiple utterances", () => {
    const synth = makeSynth();
    stubSpeech(synth);
    const engine = createSpeechEngineForTest();

    // Build a clearly-multi-sentence string > 200 chars so chunkText splits it.
    const longText = (
      "First sentence is moderately long. " +
      "Second sentence is also moderately long. " +
      "Third sentence finishes the paragraph nicely. "
    ).repeat(3);

    engine.speak(longText);

    // First chunk is sent immediately; the remaining chunks sit in the queue
    // until onend fires.
    expect(synth.speak).toHaveBeenCalledTimes(1);
    const firstChunk = getUtterance(synth, 0);
    expect(firstChunk.text.length).toBeLessThanOrEqual(200);

    // Pump the queue and make sure additional chunks materialize.
    firstChunk.onend?.();
    expect(synth.speak.mock.calls.length).toBeGreaterThan(1);
  });

  it("stop() drops the queue and the next onend doesn't pump anything new", () => {
    const synth = makeSynth();
    stubSpeech(synth);
    const engine = createSpeechEngineForTest();

    engine.speak("first");
    engine.speak("second");
    engine.stop();

    expect(synth.cancel).toHaveBeenCalled();
    expect(engine.speaking).toBe(false);

    // A late onend (after cancel) must not resurrect the queue.
    getUtterance(synth, 0).onend?.();
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it("stop() does not report a natural end event", () => {
    const synth = makeSynth();
    stubSpeech(synth);
    const engine = createSpeechEngineForTest();
    const handler = vi.fn();

    engine.setEventHandler(handler);
    engine.speak("first");
    engine.stop();

    expect(synth.speak).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalledWith("end");
  });

  it("is a no-op when speechSynthesis is missing", () => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);
    const engine = createSpeechEngineForTest();

    expect(() => engine.speak("nope")).not.toThrow();
    expect(() => engine.interrupt("nope")).not.toThrow();
    expect(engine.speaking).toBe(false);
  });
});
