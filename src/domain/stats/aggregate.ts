/**
 * Агрегация статистики чтения по сессиям. Чистые функции — покрыты тестами.
 */

import type { ReadingSession } from '../../core/models/types';

export type StatsRange = 'week' | 'month' | 'all';

export interface StatsBucket {
  /** начало периода (ms) */
  startTs: number;
  words: number;
  durationMs: number;
  sessions: number;
}

export interface StatsSummary {
  totalWords: number;
  totalMs: number;
  sessions: number;
  /** взвешенная по словам средняя скорость */
  avgWpm: number;
  /** лучшая скорость сессии (wordsRead >= MIN_WORDS_FOR_SPEED) */
  bestWpm: number;
  buckets: StatsBucket[];
  bestDayWords: number;
  bestDayTs: number;
}

export const MIN_WORDS_FOR_SPEED = 50;

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Понедельник 00:00 недели, содержащей ts. */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  const shift = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - shift);
  return d.getTime();
}

export function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function validSessions(sessions: ReadingSession[]): ReadingSession[] {
  return sessions.filter(
    (s) => s.finishedAt !== null && s.wordsRead > 0 && s.durationMs >= 3000,
  );
}

function makeBuckets(sessions: ReadingSession[], starts: number[]): StatsBucket[] {
  const buckets = starts.map((startTs) => ({ startTs, words: 0, durationMs: 0, sessions: 0 }));
  const index = new Map<number, number>();
  starts.forEach((s, i) => index.set(s, i));
  for (const s of sessions) {
    let ts = startOfDay(s.startedAt);
    // раскладываем сессию по дням, через которые она шла
    const end = s.finishedAt ?? s.startedAt;
    let guard = 0;
    while (ts <= end && guard < 400) {
      guard++;
      const i = index.get(ts);
      if (i !== undefined) {
        // доля сессии внутри этого дня (упрощённо: целиком в день старта для много-дневных)
        buckets[i].words += s.wordsRead;
        buckets[i].durationMs += s.durationMs;
        buckets[i].sessions += 1;
        break;
      }
      ts = startOfDay(ts + 86_400_000);
    }
  }
  return buckets;
}

export function aggregateSessions(
  sessions: ReadingSession[],
  range: StatsRange,
  now: number = Date.now(),
): StatsSummary {
  const valid = validSessions(sessions);

  let starts: number[];
  if (range === 'week') {
    const monday = startOfWeek(now);
    starts = Array.from({ length: 7 }, (_, i) => monday + i * 86_400_000);
  } else if (range === 'month') {
    const thisWeek = startOfWeek(now);
    starts = Array.from({ length: 4 }, (_, i) => thisWeek - (3 - i) * 7 * 86_400_000);
  } else {
    const months: number[] = [];
    let cursor = startOfMonth(now);
    for (let i = 0; i < 12; i++) {
      months.unshift(cursor);
      const d = new Date(cursor);
      d.setMonth(d.getMonth() - 1);
      cursor = d.getTime();
    }
    starts = months;
  }

  const minTs = starts[0];
  const inRange = valid.filter((s) => s.startedAt >= minTs);

  const buckets = makeBuckets(inRange, starts);

  const totalWords = inRange.reduce((acc, s) => acc + s.wordsRead, 0);
  const totalMs = inRange.reduce((acc, s) => acc + s.durationMs, 0);
  const avgWpm = totalMs > 0 ? Math.round(totalWords / (totalMs / 60_000)) : 0;
  const bestWpm = inRange
    .filter((s) => s.wordsRead >= MIN_WORDS_FOR_SPEED)
    .reduce((acc, s) => Math.max(acc, Math.round(s.avgWpm)), 0);

  let bestDayWords = 0;
  let bestDayTs = 0;
  for (const b of buckets) {
    if (b.words > bestDayWords) {
      bestDayWords = b.words;
      bestDayTs = b.startTs;
    }
  }

  return { totalWords, totalMs, sessions: inRange.length, avgWpm, bestWpm, buckets, bestDayWords, bestDayTs };
}
