export interface FrameSink {
  name: string;
  onConfig?(config: { holdMs: number; blankBetweenFrames: boolean }): void;
  onFrame(masks: number[], cellStart: number, index: number): void;
  onBlank?(): void;
}

export function createLoggingSink(): FrameSink {
  return {
    name: "log",
    onFrame: (masks, cellStart, index) =>
      console.log(`frame ${index} @${cellStart}:`, masks.map((m) => `0x${m.toString(16).padStart(2, "0")}`).join(" ")),
  };
}
