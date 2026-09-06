/**
 * ORP (Optimal Recognition Point) — опорная буква слова,
 * которая фиксируется в центре экрана, чтобы глаза не двигались.
 */

export interface OrpSplit {
  prefix: string;
  pivot: string;
  suffix: string;
  pivotIndex: number;
}

export function orpIndex(word: string): number {
  const L = word.length;
  if (L <= 1) return 0;
  if (L <= 3) return 1;
  if (L <= 6) return Math.floor(L / 2);
  if (L <= 9) return 3;
  if (L <= 13) return 4;
  return 5;
}

export function splitAtOrp(word: string): OrpSplit {
  const idx = Math.min(orpIndex(word), word.length - 1);
  return {
    prefix: word.slice(0, idx),
    pivot: word[idx],
    suffix: word.slice(idx + 1),
    pivotIndex: idx,
  };
}
