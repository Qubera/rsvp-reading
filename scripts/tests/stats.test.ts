import { assert, assertEq, suite, test } from '../testkit';
import { aggregateSessions, startOfWeek } from '../../src/domain/stats/aggregate';
import type { ReadingSession } from '../../src/core/models/types';

const NOW = new Date(2026, 8, 5, 12, 0, 0).getTime(); // суббота 5 сен 2026

function session(
  id: string,
  startedAt: number,
  durationMs: number,
  wordsRead: number,
): ReadingSession {
  return {
    id,
    documentId: 'doc1',
    startedAt,
    finishedAt: startedAt + durationMs,
    wordsRead,
    durationMs,
    avgWpm: durationMs > 0 ? wordsRead / (durationMs / 60000) : 0,
    maxWpm: 0,
  };
}

suite('stats aggregate', () => {
  test('недельный диапазон: суммы и средняя', () => {
    const monday = startOfWeek(NOW);
    const sessions = [
      session('a', monday + 3600_000, 600_000, 3000), // 10 мин, 300 wpm
      session('b', monday + 2 * 86400_000 + 3600_000, 300_000, 2500),
      session('old', monday - 10 * 86400_000, 600_000, 9999), // вне диапазона
    ];
    const s = aggregateSessions(sessions, 'week', NOW);
    assertEq(s.totalWords, 5500);
    assertEq(s.sessions, 2);
    assertEq(s.buckets.length, 7);
    assertEq(s.buckets[0].words, 3000, 'слов в понедельник');
    // взвешенная средняя: 5500 слов / (900с/60) = 366.67
    assert(Math.abs(s.avgWpm - 367) <= 1, `avgWpm ≈ 367, got ${s.avgWpm}`);
  });

  test('лучший день', () => {
    const monday = startOfWeek(NOW);
    const sessions = [
      session('a', monday, 60_000, 500),
      session('b', monday + 86400_000, 60_000, 1500),
      session('c', monday + 86400_000, 60_000, 400),
    ];
    const s = aggregateSessions(sessions, 'week', NOW);
    assertEq(s.bestDayWords, 1900);
    assertEq(s.bestDayTs, monday + 86400_000);
  });

  test('короткие сессии-мусор отфильтровываются', () => {
    const sessions = [
      session('noise', NOW - 1000, 1000, 3),
      session('real', NOW - 5000, 60_000, 400),
    ];
    const s = aggregateSessions(sessions, 'week', NOW);
    assertEq(s.sessions, 1);
    assertEq(s.totalWords, 400);
  });

  test('bestWpm учитывает только содержательные сессии', () => {
    const monday = startOfWeek(NOW);
    const sessions = [
      session('slow', monday, 600_000, 2400), // 240 wpm
      session('fast', monday + 3600_000, 60_000, 480), // 480 wpm
      session('tiny', monday + 7200_000, 20_000, 40), // 120 wpm, < 50 слов — не учитывается
    ];
    const s = aggregateSessions(sessions, 'week', NOW);
    assertEq(s.bestWpm, 480);
  });

  test('пустая статистика не падает', () => {
    const s = aggregateSessions([], 'all', NOW);
    assertEq(s.totalWords, 0);
    assertEq(s.avgWpm, 0);
    assertEq(s.bestWpm, 0);
  });
});
