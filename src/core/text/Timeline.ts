/**
 * Timeline: предварительный расчёт относительных длительностей слов.
 *
 * Ключевая идея производительности: длительность каждого слова —
 * это безразмерная «единица» (unit), а реальное время = unit * (60000 / wpm).
 * Поэтому изменение скорости — это O(1) (меняется только множитель k),
 * а не пересборка массива на 500k слов.
 */

import type { ParsedText } from './TextParser';

export interface TimingProfile {
  /** дополнительная доля паузы между словами 0..0.6 */
  wordSpacing: number;
  /** множитель пауз после пунктуации 0.5..2 */
  punctuationMultiplier: number;
  /** небольшая задержка после абзаца (юниты) */
  paragraphMultiplier: number;
}

export const DEFAULT_TIMING: TimingProfile = {
  wordSpacing: 0.15,
  punctuationMultiplier: 1,
  paragraphMultiplier: 0.85,
};

export interface Timeline {
  words: string[];
  softEnd: Uint8Array;
  strongEnd: Uint8Array;
  sentenceEnd: Uint8Array;
  paragraphEnd: Uint8Array;
  /** накопленное время КОНЦА слова i (в юнитах) */
  unitEnd: Float64Array;
  totalUnits: number;
  size: number;
}

export function unitForWord(
  word: string,
  soft: number,
  strong: number,
  paraEnd: number,
  t: TimingProfile,
): number {
  const L = word.length;
  let u: number;
  if (L <= 1) u = 0.78;
  else if (L === 2) u = 0.86;
  else if (L <= 4) u = 0.94;
  else if (L === 5) u = 1;
  else u = Math.min(1 + (L - 5) * 0.05, 1.9);

  u += t.wordSpacing;
  if (strong) u += 1.1 * t.punctuationMultiplier;
  else if (soft) u += 0.5 * t.punctuationMultiplier;
  if (paraEnd) {
    u += t.paragraphMultiplier * t.punctuationMultiplier;
  }
  return u;
}

export interface TimelineSlice {
  timeline: Timeline;
  /** индекс среза в исходном таймлайне */
  offset: number;
}

/** Срез [from, toExclusive) с пересчётом юнитов от нуля. */
export function sliceTimeline(t: Timeline, from: number, toExclusive: number): TimelineSlice {
  const a = Math.max(0, Math.min(from, t.size));
  const b = Math.max(a, Math.min(toExclusive, t.size));
  const n = b - a;
  const base = a <= 0 ? 0 : t.unitEnd[a - 1];
  const unitEnd = new Float64Array(n);
  for (let i = 0; i < n; i++) unitEnd[i] = t.unitEnd[a + i] - base;
  return {
    offset: a,
    timeline: {
      words: t.words.slice(a, b),
      softEnd: t.softEnd.subarray(a, b),
      strongEnd: t.strongEnd.subarray(a, b),
      sentenceEnd: t.sentenceEnd.subarray(a, b),
      paragraphEnd: t.paragraphEnd.subarray(a, b),
      unitEnd,
      totalUnits: n > 0 ? unitEnd[n - 1] : 0,
      size: n,
    },
  };
}

export function buildTimeline(p: ParsedText, t: TimingProfile): Timeline {
  const n = p.words.length;
  const unitEnd = new Float64Array(n);
  let cum = 0;
  for (let i = 0; i < n; i++) {
    cum += unitForWord(p.words[i], p.softEnd[i], p.strongEnd[i], p.paragraphEnd[i], t);
    unitEnd[i] = cum;
  }
  return {
    words: p.words,
    softEnd: p.softEnd,
    strongEnd: p.strongEnd,
    sentenceEnd: p.sentenceEnd,
    paragraphEnd: p.paragraphEnd,
    unitEnd,
    totalUnits: cum,
    size: n,
  };
}
