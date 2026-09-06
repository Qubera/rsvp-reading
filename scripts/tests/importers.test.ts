import { assert, assertEq, suite, test } from '../testkit';
import { zipSync, strToU8, deflateSync } from 'fflate';
import { importEpub } from '../../src/data/importers/EpubImporter';
import { importFb2, looksLikeFb2 } from '../../src/data/importers/Fb2Importer';
import { extractPdfText } from '../../src/data/importers/PdfExtractor';
import { htmlToText, decodeEntities } from '../../src/data/importers/html';
import { importTxt, titleFromFilename } from '../../src/data/importers/TxtImporter';
import { pageStartsFromPageTexts } from '../../src/data/importers/importerPages';

const encoder = new TextEncoder();

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

suite('html', () => {
  test('извлекает текст и заголовок', () => {
    const html = `
      <html><head><title>Тестовая статья</title><style>body{color:red}</style></head>
      <body>
        <nav>Меню Главная О нас</nav>
        <article>
          <h1>Заголовок</h1>
          <p>Первый абзац с текстом, который мы читаем.</p>
          <script>alert('x')</script>
          <p>Второй абзац &mdash; с символами &laquo;в кавычках&raquo;.</p>
        </article>
        <footer>Подвал сайта</footer>
      </body></html>`;
    const { title, text } = htmlToText(html);
    assertEq(title, 'Тестовая статья');
    assert(text.includes('Заголовок'), 'есть заголовок');
    assert(text.includes('Первый абзац'), 'есть первый абзац');
    assert(!text.includes('alert'), 'script удалён');
    assert(text.includes('«в кавычках»'), 'entities декодированы');
  });

  test('decodeEntities числовые', () => {
    assertEq(decodeEntities('&#1040;&#x41;'), 'АA');
  });
});

suite('TxtImporter', () => {
  test('utf8', () => {
    const r = importTxt(encoder.encode('Привет, мир!'));
    assertEq(r.text, 'Привет, мир!');
    assertEq(r.encoding, 'utf8');
  });

  test('cp1251', () => {
    const bytes = new Uint8Array([0xcf, 0xf0, 0xe8, 0xe2, 0xe5, 0xf2, 0x2c, 0x20, 0xec, 0xe8, 0xf0, 0x21]);
    const r = importTxt(bytes);
    assertEq(r.text, 'Привет, мир!');
  });

  test('titleFromFilename', () => {
    assertEq(titleFromFilename('моя_книга.txt'), 'моя книга');
    assertEq(titleFromFilename('Report.PDF'), 'Report');
  });
});

suite('EpubImporter', () => {
  test('извлекает название, автора и текст глав', () => {
    const opf = `<?xml version="1.0"?>
      <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <metadata>
          <dc:title>Тестовая книга</dc:title>
          <dc:creator>Автор Тестов</dc:creator>
        </metadata>
        <manifest>
          <item id="ch1" href="ch1.xhtml" media-type="application/xhtml+xml"/>
          <item id="ch2" href="ch2.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="ch1"/>
          <itemref idref="ch2"/>
        </spine>
      </package>`;
    const zip = zipSync({
      mimetype: strToU8('application/epub+zip'),
      'META-INF/container.xml': strToU8(
        `<?xml version="1.0"?><container><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`,
      ),
      'OEBPS/content.opf': strToU8(opf),
      'OEBPS/ch1.xhtml': strToU8(
        '<html><body><h1>Глава первая</h1><p>Привет, мир чтения!</p></body></html>',
      ),
      'OEBPS/ch2.xhtml': strToU8(
        '<html><body><p>Вторая глава продолжается.</p></body></html>',
      ),
    });
    const r = importEpub(zip);
    assertEq(r.title, 'Тестовая книга');
    assertEq(r.author, 'Автор Тестов');
    assert(r.text.includes('Глава первая'), 'есть глава 1');
    assert(r.text.includes('Привет, мир чтения!'), 'есть текст главы');
    assert(r.text.includes('Вторая глава'), 'есть глава 2 (порядок spine)');
  });
});

suite('PdfExtractor', () => {
  test('текст с ToUnicode (2-байтные коды) + переносы строк', () => {
    // Объект 8 (шрифт) лежит внутри Object Stream — проверяем ObjStm и Flate.
    const cmapText = `/CIDInit /ProcSet findresource begin
12 dict begin
begincmap
/CMapName /Test def
1 begincodespacerange
<0000> <FFFF>
endcodespacerange
3 beginbfchar
<041F> <041F>
<0440> <0440>
<0438> <0438>
endbfchar
endcmap
end`;
    const objstmData = deflateSync(strToU8('8 0\n<< /Type /Font /Subtype /Type1 /BaseFont /Test /ToUnicode 7 0 R >>'));
    const objStmDict = `<< /Type /ObjStm /N 1 /First 4 /Length ${objstmData.length} /Filter /FlateDecode >>`;
    const cmapData = deflateSync(strToU8(cmapText));
    const cmapDict = `<< /Length ${cmapData.length} /Filter /FlateDecode >>`;
    const content =
      'BT /F1 24 Tf 72 700 Td <041F04400438> Tj 0 -30 Td <0077006F0072006C0064> Tj ET';
    const contentDict = `<< /Length ${content.length} >>`;

    const pdf = concatBytes(
      encoder.encode(
        `%PDF-1.7\n` +
          `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
          `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
          `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 8 0 R >> >> >>\nendobj\n` +
          `4 0 obj\n${contentDict}\nstream\n${content}\nendstream\nendobj\n` +
          `5 0 obj\n${objStmDict}\nstream\n`,
      ),
      objstmData,
      encoder.encode(
        `\nendstream\nendobj\n` +
          `7 0 obj\n${cmapDict}\nstream\n`,
      ),
      cmapData,
      encoder.encode(`\nendstream\nendobj\n%%EOF\n`),
    );

    const r = extractPdfText(pdf);
    assertEq(r.encrypted, false);
    assertEq(r.pages.length, 1, 'одна страница');
    assertEq(r.pages[0], 'При\nworld');
  });

  test('сканированный PDF (без текстового слоя) даёт пустую страницу', () => {
    const pdf = encoder.encode(
      `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
        `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n` +
        `4 0 obj\n<< /Length 6 >>\nstream\n1 0 rg\nendstream\nendobj\n%%EOF\n`,
    );
    const r = extractPdfText(pdf);
    assertEq(r.pages.length, 1);
    assertEq(r.pages[0], '');
  });

  test('TJ-массив с kerning добавляет пробел', () => {
    const content = 'BT /F1 12 Tf 72 700 Td [(hello) -250 (world)] TJ ET';
    const pdf = encoder.encode(
      `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n` +
        `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n` +
        `3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n` +
        `4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n%%EOF\n`,
    );
    const r = extractPdfText(pdf);
    assertEq(r.pages[0], 'hello world');
  });
});

suite('Fb2Importer', () => {
  test('fb2 → текст, без binary и тегов', () => {
    const enc = new TextEncoder();
    const fb2 = `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
<description><title-info><book-title>Тестовая книга</book-title></title-info></description>
<body>
<title><p>Глава 1</p></title>
<p>Первый абзац текста.</p>
<p>Второй абзац, продолжение.</p>
<empty-line/>
<p>Третий.</p>
</body>
<binary id="img1" content-type="image/jpeg">/9j/4AAQSkZJRg==</binary>
</FictionBook>`;
    const res = importFb2(enc.encode(fb2));
    assertEq(res.title, 'Тестовая книга', 'название из book-title');
    assert(res.text.indexOf('Первый абзац текста.') !== -1, 'текст есть');
    assert(res.text.indexOf('9j/4AAQSkZJRg') === -1, 'base64 выброшен');
    assert(res.text.indexOf('<FictionBook') === -1, 'тегов нет');
  });

  test('looksLikeFb2 sniff', () => {
    const enc = new TextEncoder();
    assert(looksLikeFb2(enc.encode('<?xml version="1.0"?><FictionBook><body/>')), 'fb2 определяется');
    assert(!looksLikeFb2(enc.encode('Просто текст файла')), 'обычный текст не fb2');
  });
});

suite('pages', () => {
  test('pageStartsFromPageTexts считает слова постранично', () => {
    const starts = pageStartsFromPageTexts(['Два слова тут.', 'Ещё три слова здесь тоже.']);
    assertEq(starts, [0, 3]);
  });
});
