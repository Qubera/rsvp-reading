/** Извлечение читаемого текста из HTML (веб-страницы, XHTML из EPUB). */

export interface HtmlExtract {
  title: string;
  text: string;
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00A0',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  laquo: '«',
  raquo: '»',
  ldquo: '“',
  rdquo: '”',
  rsquo: '’',
  middot: '·',
  bull: '•',
  times: '×',
  copy: '©',
  reg: '®',
  trade: '™',
  deg: '°',
  minus: '−',
  shy: '',
  zwj: '',
  zwnj: '',
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (m, body: string) => {
    if (body[0] === '#') {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(body.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return m;
      if (code > 0xffff) {
        const c = code - 0x10000;
        return String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 0x3ff));
      }
      return String.fromCharCode(code);
    }
    const named = ENTITIES[body.toLowerCase()];
    return named ?? m;
  });
}

function extractTitle(html: string): string {
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t && t[1].trim()) return decodeEntities(t[1].trim()).replace(/\s+/g, ' ');
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og) return decodeEntities(og[1]);
  return '';
}

/** Основной контент: <article>, <main> или <body>. */
function isolateContent(html: string): string {
  const article = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (article && article[1].length > 200) return article[1];
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (main && main[1].length > 200) return main[1];
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return body ? body[1] : html;
}

export function htmlToText(html: string): HtmlExtract {
  const title = extractTitle(html);
  let s = isolateContent(html);

  s = s
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|head|nav|footer|aside|form|iframe)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // блочные элементы = абзацы (пустая строка): парсер считает абзацем только \n\n
    .replace(/<\/(p|div|section|h[1-6]|tr|blockquote|figcaption|pre)>/gi, '\n\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<hr[^>]*>/gi, '\n\n');

  // маркеры списков
  s = s.replace(/<li[^>]*>/gi, '• ');

  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);

  // Пустая строка = граница абзаца — сохраняем её (одну), остальные схлопываем
  const rawLines = s.split('\n').map((l) => l.replace(/[ \t\u00A0]+/g, ' ').trim());
  const lines: string[] = [];
  for (const l of rawLines) {
    if (l.length === 0) {
      if (lines.length > 0 && lines[lines.length - 1] !== '') lines.push('');
    } else {
      lines.push(l);
    }
  }

  const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { title, text };
}
