/**
 * TextParser: превращает исходный текст в поток слов с флагами
 * пунктуации/абзацев. Не зависит от UI и движка тайминга.
 */

export interface ParsedText {
  words: string[];
  /** мягкая пауза после слова (запятая, двоеточие) */
  softEnd: Uint8Array;
  /** сильная пауза после слова (точка, ?, !, …) */
  strongEnd: Uint8Array;
  /** конец предложения (сильная пауза или конец абзаца) */
  sentenceEnd: Uint8Array;
  /** конец абзаца */
  paragraphEnd: Uint8Array;
  paragraphCount: number;
}

const STRONG_PUNCT = /[.!?…]["»”')\]]*$/u;
const SOFT_PUNCT = /[,;:]$/u;
const HAS_ALNUM = /[\p{L}\p{N}]/u;
const DASH_ONLY = /^[-–—]+$/u;

const MAX_TOKEN_LENGTH = 20;
const CHUNK_LENGTH = 12;

export function parseText(raw: string): ParsedText {
  const text = raw
    .replace(/\r\n?/g, '\n')
    .replace(/\u00AD/g, '')
    .replace(/\uFEFF/g, '');

  const lines = text.split('\n');

  const words: string[] = [];
  const softEnds: number[] = [];
  const strongEnds: number[] = [];
  const sentenceEnds: number[] = [];
  const paragraphEnds: number[] = [];
  let paragraphCount = 0;

  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const paragraph = buffer.join(' ').replace(/\s+/g, ' ').trim();
    buffer = [];
    if (!paragraph) return;
    paragraphCount++;
    const tokens = paragraph.split(' ');
    const isParaEnd = true;
    for (let t = 0; t < tokens.length; t++) {
      const tok = tokens[t];
      if (!tok || !HAS_ALNUM.test(tok)) continue; // чистая пунктуация («—», ««») — пропускаем
      if (DASH_ONLY.test(tok)) continue;

      const strong = STRONG_PUNCT.test(tok) ? 1 : 0;
      const soft = strong ? 0 : SOFT_PUNCT.test(tok) ? 1 : 0;
      const paraEnd = t === tokens.length - 1 && isParaEnd ? 1 : 0;

      if (tok.length > MAX_TOKEN_LENGTH) {
        // длинные токены (URL и т.п.) режем на части для читаемости
        const parts: string[] = [];
        for (let j = 0; j < tok.length; j += CHUNK_LENGTH) {
          const piece = tok.slice(j, j + CHUNK_LENGTH);
          parts.push(j + CHUNK_LENGTH < tok.length ? piece + '-' : piece);
        }
        for (let p = 0; p < parts.length; p++) {
          const isLast = p === parts.length - 1;
          words.push(parts[p]);
          softEnds.push(!isLast ? 0 : soft);
          strongEnds.push(!isLast ? 0 : strong);
          sentenceEnds.push(isLast && (strong || paraEnd) ? 1 : 0);
          paragraphEnds.push(isLast ? paraEnd : 0);
        }
      } else {
        words.push(tok);
        softEnds.push(soft);
        strongEnds.push(strong);
        sentenceEnds.push(strong || paraEnd ? 1 : 0);
        paragraphEnds.push(paraEnd);
      }
    }
  };

  // Абзац — только там, где есть пустая строка (как в книгах/PDF/EPUB).
  // Одиночный перенос строки — перенос внутри абзаца: иначе каждое предложение,
  // разрезанное переносом после точки или «...», получало бы автопаузу ридера.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      flush();
      continue;
    }
    buffer.push(line);
  }
  flush();

  return {
    words,
    softEnd: Uint8Array.from(softEnds),
    strongEnd: Uint8Array.from(strongEnds),
    sentenceEnd: Uint8Array.from(sentenceEnds),
    paragraphEnd: Uint8Array.from(paragraphEnds),
    paragraphCount,
  };
}

export function countWords(raw: string): number {
  return parseText(raw).words.length;
}

export interface TextBlock {
  /** индекс первого слова (глобальный) */
  start: number;
  /** индекс за последним словом */
  end: number;
  /** блок начинается новый абзац (для отступа) */
  paragraphStart: boolean;
}

/**
 * Блоки для Focus Reading: единица рендера/прокрутки.
 * Обычные абзацы идут целиком; абзацы длиннее maxBlockWords режутся,
 * чтобы авто-прокрутка оставалась точной.
 */
export function buildBlocks(p: ParsedText, maxBlockWords = 55): TextBlock[] {
  const blocks: TextBlock[] = [];
  const n = p.words.length;
  let start = 0;
  for (let i = 0; i < n; i++) {
    const paraEnd = p.paragraphEnd[i] === 1 || i === n - 1;
    const len = i - start + 1;
    if (paraEnd || len >= maxBlockWords) {
      blocks.push({ start, end: i + 1, paragraphStart: start === 0 || p.paragraphEnd[start - 1] === 1 });
      start = i + 1;
    }
  }
  return blocks;
}
