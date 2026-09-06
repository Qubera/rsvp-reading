import { assertEq, suite, test } from '../testkit';
import { decodeTextBytes, decodeUtf8, decodeWindows1251 } from '../../src/core/text/decode';
import { formatNumber, formatDuration, pluralRu, wordsLabel } from '../../src/core/utils/format';

function utf8Bytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

suite('decode', () => {
  test('UTF-8 кириллица', () => {
    const r = decodeUtf8(utf8Bytes('Пример текста'));
    assertEq(r.errors, 0);
    assertEq(r.text, 'Пример текста');
  });

  test('BOM обрезается', () => {
    const bytes = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8Bytes('Тест')]);
    const r = decodeUtf8(bytes);
    assertEq(r.text, 'Тест');
  });

  test('эmoji (4 байта)', () => {
    const r = decodeUtf8(utf8Bytes('a🎉b'));
    assertEq(r.errors, 0);
    assertEq(r.text, 'a🎉b');
  });

  test('CP1251 распознаётся и декодируется', () => {
    // «Пример» в CP1251
    const bytes = new Uint8Array([0xcf, 0xf0, 0xe8, 0xec, 0xe5, 0xf0]);
    const r = decodeTextBytes(bytes);
    assertEq(r.encoding, 'cp1251');
    assertEq(r.text, 'Пример');
    assertEq(decodeWindows1251(bytes), 'Пример');
  });

  test('битый UTF-8 уходит в CP1251', () => {
    const bytes = new Uint8Array([0xd0, 0x9f, 0xd1, 0x80, 0xff, 0xfe]); // 0xFF invalid в UTF-8
    const r = decodeTextBytes(bytes);
    assertEq(r.encoding, 'cp1251');
  });
});

suite('format', () => {
  test('formatNumber с разделителями', () => {
    assertEq(formatNumber(12488), '12\u00A0488');
    assertEq(formatNumber(124), '124');
    assertEq(formatNumber(1000000), '1\u00A0000\u00A0000');
  });

  test('русские склонения', () => {
    assertEq(pluralRu(1, 'слово', 'слова', 'слов'), 'слово');
    assertEq(pluralRu(2, 'слово', 'слова', 'слов'), 'слова');
    assertEq(pluralRu(5, 'слово', 'слова', 'слов'), 'слов');
    assertEq(pluralRu(11, 'слово', 'слова', 'слов'), 'слов');
    assertEq(pluralRu(21, 'слово', 'слова', 'слов'), 'слово');
  });

  test('wordsLabel по языкам', () => {
    assertEq(wordsLabel(12488, 'ru'), 'слов');
    assertEq(wordsLabel(12488, 'kk'), 'сөз');
    assertEq(wordsLabel(12488, 'en'), 'words');
  });

  test('formatDuration', () => {
    assertEq(formatDuration(5 * 3600_000 + 42 * 60_000, 'ru'), '5 ч 42 мин');
    assertEq(formatDuration(35_000, 'ru'), '35 с');
    assertEq(formatDuration(0, 'ru'), '0 с');
  });
});
