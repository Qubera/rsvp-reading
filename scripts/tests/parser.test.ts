import { assert, assertEq, suite, test } from '../testkit';
import { buildBlocks, parseText } from '../../src/core/text/TextParser';

suite('TextParser', () => {
  test('разбивает текст на слова и предложения', () => {
    const p = parseText('Сегодня я начинаю читать эту книгу.\n\nВторая глава будет длинной!');
    assertEq(p.words.length, 10, 'слов всего');
    assertEq(p.paragraphCount, 2, 'абзацев');
    assertEq(p.words[0], 'Сегодня');
    assertEq(p.words[5], 'книгу.');
    assertEq(p.strongEnd[5], 1, 'книгу. — сильная пауза');
    assertEq(p.sentenceEnd[5], 1);
    assertEq(p.paragraphEnd[5], 1, 'конец первого абзаца');
    assertEq(p.words[9], 'длинной!');
    assertEq(p.strongEnd[9], 1);
  });

  test('мягкий перенос строк склеивается в абзац', () => {
    const p = parseText('Это предложение перенесено\nна новую строку без точки');
    assertEq(p.paragraphCount, 1, 'один абзац');
    assertEq(p.words.length, 8);
  });

  test('одиночный перенос строки — НЕ абзац (автопауза не срабатывает)', () => {
    const p = parseText('Первая строка.\nВторая строка.');
    assertEq(p.paragraphCount, 1, 'перенос без пустой строки — тот же абзац');
    assertEq(p.paragraphEnd[p.words.indexOf('строка.')], 0);
  });

  test('многоточие в конце перенесённой строки не создаёт абзац', () => {
    const p = parseText(
      'летит искать куст терновника и не успокоится, пока не найдёт...\nпосле многоточия чтение продолжается без остановки',
    );
    assertEq(p.paragraphCount, 1, 'автопауза после «...» не должна включаться');
    const tok = p.words.find((w) => w.endsWith('...'));
    assert(tok !== undefined, 'токен с многоточием есть');
    assertEq(p.strongEnd[p.words.indexOf(tok!)], 1, 'но пауза после многоточия есть');
  });

  test('buildBlocks: абзацы и нарезка длинных', () => {
    const p = parseText('Первый абзац из нескольких слов здесь.\n\nВторой абзац покороче!');
    const blocks = buildBlocks(p, 55);
    assertEq(blocks.length, 2, 'два абзаца — два блока');
    assertEq(blocks[0].start, 0);
    assertEq(blocks[1].paragraphStart, true, 'второй блок начинает абзац');

    // длинный абзац без границ режется на куски по maxBlockWords
    const longText = Array.from({ length: 150 }, (_, i) => `слово${i}.`).join(' ');
    const lp = parseText(longText);
    const lb = buildBlocks(lp, 55);
    assert(lb.length >= 3, 'длинный абзац нарезан');
    for (const b of lb) assert(b.end - b.start <= 55, 'блок не длиннее лимита');
    assertEq(lb.reduce((a, b) => Math.min(a, b.start), Infinity), 0, 'блоки начинаются с нуля');
  });

  test('тире как отдельный токен пропускается', () => {
    const p = parseText('Слово — другое');
    assertEq(p.words.length, 2);
    assertEq(p.words[0], 'Слово');
    assertEq(p.words[1], 'другое');
  });

  test('длинные токены режутся на части', () => {
    const p = parseText('Короткое https://example.com/very/long/url/path/token тут');
    assert(p.words.length >= 4, 'токен разрезан');
    assert(p.words.every((w) => w.length <= 13), 'все части короткие');
  });

  test('пустой текст', () => {
    const p = parseText('   \n \n');
    assertEq(p.words.length, 0);
    assertEq(p.paragraphCount, 0);
  });

  test('кавычки сохраняются в слове', () => {
    const p = parseText('Он сказал: «Привет, мир!»');
    const привет = p.words.find((w) => w.includes('Привет'));
    assert(привет !== undefined, 'слово с кавычкой найдено');
    assertEq(p.softEnd[p.words.indexOf(привет!)], 1, 'запятая внутри — мягкая пауза');
  });
});
