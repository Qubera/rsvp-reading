import { assert, assertClose, assertEq, suite, test } from '../testkit';
import { parseText } from '../../src/core/text/TextParser';
import { buildTimeline, DEFAULT_TIMING, type Timeline } from '../../src/core/text/Timeline';
import { ReaderEngine } from '../../src/core/reader/ReaderEngine';
import { splitAtOrp, orpIndex } from '../../src/core/reader/orp';

/** Ручной планировщик + фейковые часы для детерминированных тестов. */
function makeHarness(timeline: Timeline, wpm: number, startIndex = 0) {
  let now = 0;
  const clock = () => now;
  let callback: (() => void) | null = null;
  const scheduler = {
    request(cb: () => void): number {
      callback = cb;
      return 1;
    },
    cancel(): void {
      callback = null;
    },
  };
  const engine = new ReaderEngine(timeline, { wpm, startIndex, clock, scheduler });
  const words: number[] = [];
  const states: string[] = [];
  engine.onWord((i) => words.push(i));
  engine.onStateChange((s) => states.push(s));
  const step = (ms: number) => {
    now += ms;
    if (callback) {
      const cb = callback;
      callback = null;
      cb();
    }
  };
  return { engine, words, states, step, setNow: (t: number) => (now = t) };
}

const TEXT =
  'Сегодня я начинаю читать эту книгу. Это будет быстро! А здесь третий фрагмент текста.';

function sampleTimeline(): Timeline {
  return buildTimeline(parseText(TEXT), DEFAULT_TIMING);
}

suite('ReaderEngine', () => {
  test('последовательно выдаёт слова по времени', () => {
    const h = makeHarness(sampleTimeline(), 600); // 100 мс на базовое слово
    h.engine.play();
    h.step(1);
    assertEq(h.engine.currentIndex, 0, 'стартовое слово');
    h.step(200);
    assert(h.engine.currentIndex >= 1, 'прошло 200мс — индекс вырос');
    h.step(400);
    assert(h.engine.currentIndex >= 4, 'прошло 600мс — индекс ещё вырос');
    assertEq(h.engine.currentState, 'playing');
  });

  test('пауза останавливает время, play продолжает с того же места', () => {
    const h = makeHarness(sampleTimeline(), 600);
    h.engine.play();
    h.step(250);
    h.engine.pause();
    const idx = h.engine.currentIndex;
    const elapsed = h.engine.unitsElapsed();
    h.step(1000);
    assertEq(h.engine.unitsElapsed(), elapsed, 'время заморожено на паузе');
    assertEq(h.engine.currentIndex, idx);
    h.engine.play();
    h.step(300);
    assert(h.engine.currentIndex >= idx, 'после возобновления индекс не откатывается');
  });

  test('смена WPM мгновенна и сохраняет позицию', () => {
    const h = makeHarness(sampleTimeline(), 600);
    h.engine.play();
    h.step(300);
    const unitsBefore = h.engine.unitsElapsed();
    h.engine.setWpm(1200);
    assertClose(h.engine.unitsElapsed(), unitsBefore, 1e-9, 'позиция не скачет');
    assertEq(h.engine.wpm, 1200);
    // при 600 wpm базовое слово 100мс, при 1200 — 50мс
    const idxAtSwitch = h.engine.currentIndex;
    h.step(1000);
    assert(h.engine.currentIndex > idxAtSwitch, 'движение продолжилось');
  });

  test('seekToIndex выдаёт слово и корректно играет дальше', () => {
    const h = makeHarness(sampleTimeline(), 300, 0);
    h.engine.seekToIndex(5);
    assertEq(h.engine.currentIndex, 5);
    h.engine.play();
    h.step(500);
    assert(h.engine.currentIndex >= 5, 'играет с новой позиции');
    assert(h.engine.currentIndex < h.engine.size, 'не выходит за пределы');
  });

  test('finish событие в конце текста', () => {
    const h = makeHarness(sampleTimeline(), 1500);
    h.engine.play();
    for (let i = 0; i < 200 && h.engine.currentState !== 'finished'; i++) h.step(100);
    assertEq(h.engine.currentState, 'finished', 'достигнут финал');
    assertEq(h.engine.currentIndex, h.engine.size - 1);
  });

  test('play после finish начинает заново', () => {
    const h = makeHarness(sampleTimeline(), 1500);
    h.engine.play();
    for (let i = 0; i < 200 && h.engine.currentState !== 'finished'; i++) h.step(100);
    h.engine.play();
    h.step(1);
    assertEq(h.engine.currentIndex, 0, 'начали с нуля');
    assertEq(h.engine.currentState, 'playing');
  });

  test('nextSentence / previousSentence', () => {
    const h = makeHarness(sampleTimeline(), 300);
    h.engine.seekToIndex(1); // «я» из первого предложения
    h.engine.nextSentence();
    assertEq(h.engine.currentIndex, 6, '«Это» — начало второго предложения');
    h.engine.previousSentence();
    assertEq(h.engine.currentIndex, 0, 'возврат к первому предложению');
  });

  test('replaceTimeline сохраняет позицию', () => {
    const h = makeHarness(sampleTimeline(), 300);
    h.engine.seekToIndex(4);
    h.engine.replaceTimeline(sampleTimeline());
    assertEq(h.engine.currentIndex, 4);
  });

  test('масштабирование времени линейно по WPM (ключевой инвариант)', () => {
    const tl = sampleTimeline();
    const e1 = new ReaderEngine(tl, { wpm: 300 });
    const e2 = new ReaderEngine(tl, { wpm: 900 });
    const t1 = e1.timeForIndex(7);
    const t2 = e2.timeForIndex(7);
    assertClose(t1 / t2, 3, 1e-6, 'время обратно пропорционально скорости');
  });
});

suite('ORP', () => {
  test('pivot для «привет» — буква «в» (индекс 3), как в спецификации «при[в]ет»', () => {
    assertEq(orpIndex('привет'), 3);
    const s = splitAtOrp('привет');
    assertEq(s.prefix, 'при');
    assertEq(s.pivot, 'в');
    assertEq(s.suffix, 'ет');
  });

  test('короткие и длинные слова', () => {
    assertEq(splitAtOrp('я').pivot, 'я');
    assertEq(orpIndex('сегодня'), 3);
    assertEq(orpIndex('фотографируешься'), 5);
    assert(splitAtOrp('здравствуйте').pivot.length === 1, 'pivot — один символ');
  });

  test('склейка частей возвращает исходное слово', () => {
    for (const w of ['а', 'мир', 'привет', 'здравствуйте', 'электричество']) {
      const s = splitAtOrp(w);
      assertEq(s.prefix + s.pivot + s.suffix, w);
    }
  });
});
