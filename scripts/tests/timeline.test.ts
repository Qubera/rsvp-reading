import { assert, assertClose, assertEq, suite, test } from '../testkit';
import { parseText } from '../../src/core/text/TextParser';
import { buildTimeline, DEFAULT_TIMING, type Timeline } from '../../src/core/text/Timeline';

const SAMPLE =
  'Сегодня я начинаю читать эту книгу.\n\nВо-вторых, скорость чтения растёт постепенно, шаг за шагом!';

function build(text: string, timing = DEFAULT_TIMING): Timeline {
  return buildTimeline(parseText(text), timing);
}

suite('Timeline', () => {
  test('unitEnd монотонно растёт и корректен по размеру', () => {
    const t = build(SAMPLE);
    assertEq(t.size, 14);
    assertEq(t.unitEnd.length, 14);
    for (let i = 1; i < t.size; i++) {
      assert(t.unitEnd[i] > t.unitEnd[i - 1], `юнит ${i} растёт`);
    }
    assertClose(t.totalUnits, t.unitEnd[t.size - 1], 1e-9);
  });

  test('длинное слово дольше короткого', () => {
    const t = build('Я фотографируешься.');
    const unitShort = t.unitEnd[0];
    const unitLong = t.unitEnd[1] - t.unitEnd[0];
    assert(unitLong > unitShort, `длинное (${unitLong}) > короткого (${unitShort})`);
  });

  test('точка даёт бо́льшую паузу, чем запятая', () => {
    const dot = build('Слово. Далее');
    const comma = build('Слово, далее');
    const dotExtra = dot.unitEnd[0] - 1; // минус базовая единица
    const commaExtra = comma.unitEnd[0] - 1;
    assert(dotExtra > commaExtra, `точка ${dotExtra} > запятая ${commaExtra}`);
  });

  test('задержка после абзаца — небольшая и настраиваемая', () => {
    const withPause = build('Первый.\n\nВторой.', { ...DEFAULT_TIMING, paragraphMultiplier: 0.85 });
    const without = build('Первый.\n\nВторой.', { ...DEFAULT_TIMING, paragraphMultiplier: 0 });
    assert(withPause.totalUnits > without.totalUnits, 'абзацная задержка увеличивает длительность');
    const paraExtra = withPause.unitEnd[0] - 1 - (1.1 * DEFAULT_TIMING.punctuationMultiplier);
    assert(paraExtra > 0 && paraExtra < 1.2, `задержка после абзаца небольшая (${paraExtra.toFixed(2)})`);
  });

  test('wordSpacing увеличивает каждое слово', () => {
    const a = build('одно слово тут', { ...DEFAULT_TIMING, wordSpacing: 0 });
    const b = build('одно слово тут', { ...DEFAULT_TIMING, wordSpacing: 0.3 });
    assertClose(b.totalUnits - a.totalUnits, 3 * 0.3, 1e-6);
  });

  test('sentenceEnd размечает границы предложений', () => {
    const t = build('Первое предложение. Второе!');
    assertEq(t.sentenceEnd[1], 1, 'конец первого предложения');
    assertEq(t.sentenceEnd[2], 1, 'конец второго');
    assertEq(t.sentenceEnd[0], 0);
  });
});
