/**
 * Reading helpers — pure functions shared by the Reader module.
 *
 * Additive Phase 1 "Reader excellence" utilities: sentence splitting for
 * sentence-by-sentence navigation, and reading-time estimation. No DOM or
 * React dependencies so they stay trivially unit-testable.
 */

/**
 * Split a single chunk of text into sentences.
 *
 * Uses the same sentence-boundary regex as splitIntoChunks in
 * contentCleaner.ts so the two stay consistent. A trailing fragment
 * without terminal punctuation is preserved as its own sentence, and text
 * with no sentence boundaries at all comes back as a single-element array
 * — never an empty one for non-empty input.
 */
export function splitIntoSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences: string[] = [];
  const boundary = /[^.!?]+[.!?]+\s*/g;
  let lastEnd = 0;

  // exec loop rather than matchAll — no reliance on ES2020 lib targets.
  let match: RegExpExecArray | null = boundary.exec(trimmed);
  while (match !== null) {
    const sentence = match[0].trim();
    if (sentence) sentences.push(sentence);
    lastEnd = match.index + match[0].length;
    match = boundary.exec(trimmed);
  }

  const rest = trimmed.slice(lastEnd).trim();
  if (rest) sentences.push(rest);

  return sentences.length > 0 ? sentences : [trimmed];
}

/** Average silent-reading pace used for the estimate (words per minute). */
const BASE_WORDS_PER_MINUTE = 200;

/**
 * Estimate reading time in minutes for a block of text at the given speech
 * rate. Returns raw minutes (fractional); callers decide how to format.
 * A rate of 0 or below falls back to the base pace instead of dividing by
 * zero — defensive only, the store clamps rates well above that.
 */
export function estimateReadingMinutes(text: string, rate: number): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  if (words === 0) return 0;
  const effectiveRate = rate > 0 ? rate : 1;
  return words / (BASE_WORDS_PER_MINUTE * effectiveRate);
}

/** Quick-pick speeds shown next to the Reader's speed slider. */
export const READER_SPEED_PRESETS = [0.8, 1.0, 1.2, 1.5] as const;
