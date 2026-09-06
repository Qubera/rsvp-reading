/**
 * Извлечение текста из PDF на чистом TS (без DOM и pdf.js).
 *
 * Поддержка:
 *  - объекты верхнего уровня + Object Streams (/Type/ObjStm, PDF 1.5+);
 *  - FlateDecode (fflate.inflateSync);
 *  - страницы из дерева Pages с наследованием /Resources;
 *  - шрифты с /ToUnicode (bfchar/bfrange, 1-2 байтные коды);
 *  - операторы Tj, TJ, ', ", Tf, Td, TD, T*, Tm; перенос строк по движению по Y.
 *
 * Ограничения (осознанные): сканированные PDF без текстового слоя дают пустой
 * результат; зашифрованные PDF не расшифровываются. Это честно сообщается UI.
 */

import { inflateSync } from 'fflate';

export interface PdfExtractResult {
  pages: string[];
  title: string;
  encrypted: boolean;
}

interface PdfObj {
  num: number;
  /** словарь (latin1), часть объекта до stream */
  dict: string;
  /** данные потока после применения фильтров */
  data?: Uint8Array;
}

function bytesToLatin1(bytes: Uint8Array): string {
  let out = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    out += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, Math.min(i + CH, bytes.length))) as unknown as number[],
    );
  }
  return out;
}

function latin1ToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

/** CP1251 для текстов без ToUnicode (частый случай русских PDF). */
function decodeCp1251Bytes(bytes: Uint8Array): string {
  const HIGH =
    '\u0402\u0403\u201A\u0453\u201E\u2026\u2020\u2021\u20AC\u2030\u0409\u2039\u040A\u040C\u040B\u040F' +
    '\u0452\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u0020\u2122\u0459\u203A\u045A\u045C\u045B\u045F' +
    '\u00A0\u040E\u045E\u0408\u00A4\u0490\u00A6\u00A7\u0401\u00A9\u0404\u00AB\u00AC\u00AD\u00AE\u0407' +
    '\u00B0\u00B1\u0406\u0456\u0491\u00B5\u00B6\u00B7\u0451\u2116\u0454\u00BB\u0458\u0405\u0455\u0457' +
    '\u0410\u0411\u0412\u0413\u0414\u0415\u0416\u0417\u0418\u0419\u041A\u041B\u041C\u041D\u041E\u041F' +
    '\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042A\u042B\u042C\u042D\u042E\u042F' +
    '\u0430\u0431\u0432\u0433\u0434\u0435\u0436\u0437\u0438\u0439\u043A\u043B\u043C\u043D\u043E\u043F' +
    '\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044A\u044B\u044C\u044D\u044E\u044F';
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    out += b < 0x80 ? String.fromCharCode(b) : HIGH[b - 0x80];
  }
  return out;
}

/** UTF-16BE → строка (для CMap-значений и hex-строк). */
function decodeUtf16BE(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    out += String.fromCharCode((bytes[i] << 8) | bytes[i + 1]);
  }
  return out;
}

/** UTF-16LE → строка (некоторые /Title пишут в LE). */
function decodeUtf16LE(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    out += String.fromCharCode(bytes[i + 1] << 8 | bytes[i]);
  }
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  const len = clean.length >> 1;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

// ------------------------------ CMap (ToUnicode) ------------------------------

interface FontCMap {
  map: Map<number, string>;
  codeWidth: number; // 1 или 2 байта
}

function parseCMap(text: string): FontCMap {
  const map = new Map<number, string>();
  let codeWidth = 0;

  const pushEntry = (codeHex: string, valueHex: string) => {
    const code = parseInt(codeHex.replace(/[^0-9a-fA-F]/g, ''), 16);
    const bytes = hexToBytes(valueHex);
    map.set(code, decodeUtf16BE(bytes));
    if (!codeWidth) codeWidth = codeHex.replace(/[^0-9a-fA-F]/g, '').length / 2;
  };

  const bfcharBlocks = text.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? [];
  for (const block of bfcharBlocks) {
    const re = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(block)) !== null) pushEntry(m[1], m[2]);
  }

  const bfrangeBlocks = text.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? [];
  for (const block of bfrangeBlocks) {
    // форма 1: <lo> <hi> <dst> — dst задаёт базовый символ
    const simpleRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;
    let m: RegExpExecArray | null;
    while ((m = simpleRe.exec(block)) !== null) {
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      if (!codeWidth) codeWidth = m[1].replace(/[^0-9a-fA-F]/g, '').length / 2;
      const dstBytes = hexToBytes(m[3]);
      const base = decodeUtf16BE(dstBytes).codePointAt(0) ?? 0;
      for (let c = lo; c <= hi && c - lo < 65536; c++) {
        map.set(c, String.fromCharCode(base + (c - lo)));
      }
    }
    // форма 2: <lo> <hi> [<dst1> <dst2> ...]
    const arrayRe = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*\[([\s\S]*?)\]/g;
    while ((m = arrayRe.exec(block)) !== null) {
      const lo = parseInt(m[1], 16);
      if (!codeWidth) codeWidth = m[1].replace(/[^0-9a-fA-F]/g, '').length / 2;
      const values = m[3].match(/<([0-9a-fA-F]+)>/g) ?? [];
      values.forEach((v, k) => pushEntry((lo + k).toString(16).padStart(m![1].length, '0'), v));
    }
  }

  if (!codeWidth) codeWidth = 1;
  return { map, codeWidth: Math.min(4, Math.max(1, codeWidth)) };
}

// ------------------------------ Парсинг объектов ------------------------------

function collectObjects(raw: string, out: Map<number, PdfObj>): void {
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const num = parseInt(m[1], 10);
    if (out.has(num)) continue;
    const start = m.index + m[0].length;
    let end = raw.indexOf('endobj', start);
    if (end === -1) end = Math.min(start + 200000, raw.length);
    const body = raw.slice(start, end);
    addObjectBody(num, body, out);
    re.lastIndex = end;
  }
}

function addObjectBody(num: number, body: string, out: Map<number, PdfObj>): void {
  const streamIdx = body.search(/stream\r?\n/);
  if (streamIdx === -1) {
    out.set(num, { num, dict: body });
    return;
  }
  const dict = body.slice(0, streamIdx);
  const dataStart = streamIdx + (body.slice(streamIdx).match(/^stream\r?\n/) as RegExpMatchArray)[0].length;
  const dataEnd = body.lastIndexOf('endstream');
  const streamBytes = latin1ToBytes(dataEnd > dataStart ? body.slice(dataStart, dataEnd) : '');
  const obj: PdfObj = { num, dict, data: streamBytes };
  if (/FlateDecode/.test(dict)) {
    if (/\/Subtype\s*\/Image/.test(dict)) {
      // картинки не нужны — не тратим время на распаковку
    } else {
      const tryInflate = (b: Uint8Array): Uint8Array | null => {
        try {
          return inflateSync(b);
        } catch {
          return null;
        }
      };
      const Lm = dict.match(/\/Length\s+(\d+)/);
      const L = Lm ? parseInt(Lm[1], 10) : NaN;
      // некоторые файлы содержат лишний байт после stream — пробуем варианты срезов
      let out: Uint8Array | null = tryInflate(streamBytes);
      if (!out && Number.isFinite(L)) out = tryInflate(streamBytes.subarray(0, L));
      if (!out && Number.isFinite(L)) out = tryInflate(streamBytes.subarray(2, 2 + L));
      if (!out) out = tryInflate(streamBytes.subarray(2));
      if (!out) out = tryInflate(streamBytes.subarray(1));
      obj.data = out ?? streamBytes;
    }
  }
  out.set(num, obj);

  // Object Streams → вложенные объекты
  if (/\/Type\s*\/ObjStm/.test(dict) && obj.data) {
    const text = bytesToLatin1(obj.data);
    const n = parseInt(dict.match(/\/N\s+(\d+)/)?.[1] ?? '0', 10);
    const first = parseInt(dict.match(/\/First\s+(\d+)/)?.[1] ?? '0', 10);
    const header = text.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < n && i * 2 + 1 < header.length; i++) {
      const childNum = header[i * 2];
      const offset = header[i * 2 + 1];
      const nextOffset = i + 1 < n && (i + 1) * 2 + 1 < header.length ? header[(i + 1) * 2 + 1] : text.length - first;
      const bodyText = text.slice(first + offset, first + (i + 1 < n ? nextOffset : text.length - first));
      if (!out.has(childNum)) {
        const wrapped = bodyText.replace(/^\d+\s+\d+\s+obj/, '').replace(/endobj$/, '');
        out.set(childNum, { num: childNum, dict: wrapped });
      }
    }
  }
}

// ------------------------------ Извлечение текста ------------------------------

interface FontInfo {
  cmap: FontCMap | null;
  hasIdentity: boolean;
}

function showBytes(bytes: Uint8Array, font: FontInfo): string {
  if (font.cmap && font.cmap.map.size > 0) {
    const w = font.cmap.codeWidth;
    let out = '';
    for (let i = 0; i + w <= bytes.length; i += w) {
      let code = 0;
      for (let k = 0; k < w; k++) code = (code << 8) | bytes[i + k];
      out += font.cmap.map.get(code) ?? (code >= 0x20 ? String.fromCharCode(code & 0xff) : '');
    }
    return out;
  }
  // без ToUnicode: ASCII/CP1251-эвристика
  let allAscii = true;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] >= 0x80) {
      allAscii = false;
      break;
    }
  }
  return allAscii ? bytesToLatin1(bytes) : decodeCp1251Bytes(bytes);
}

function decodeContentStream(content: string, fonts: Map<string, FontInfo>): string {
  let out = '';
  let currentFont: FontInfo = { cmap: null, hasIdentity: false };
  let lastY: number | null = null;
  let fontSize = 12;

  const operands: (string | Uint8Array | number)[] = [];

  const emitNewline = (para: boolean) => {
    const suffix = para ? '\n\n' : '\n';
    if (!out.endsWith(suffix)) out += suffix;
  };

  const show = (bytes: Uint8Array) => {
    out += showBytes(bytes, currentFont);
  };

  let i = 0;
  const n = content.length;
  let iters = 0;
  const maxIters = n * 50 + 10000;
  while (i < n) {
    if (++iters > maxIters) break; // страховка от зацикливания на бинарном мусоре
    const ch = content[i];
    if (ch === '(') {
      // literal string с вложенностью и escape
      let depth = 1;
      const bytes: number[] = [];
      i++;
      while (i < n && depth > 0) {
        const c = content[i];
        if (c === '\\') {
          const e = content[i + 1];
          if (e === 'n') bytes.push(10);
          else if (e === 'r') bytes.push(13);
          else if (e === 't') bytes.push(9);
          else if (e === 'b' || e === 'f') bytes.push(e === 'f' ? 12 : 8);
          else if (e >= '0' && e <= '7') {
            const oct = content.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)?.[0] ?? '';
            if (oct) {
              bytes.push(parseInt(oct, 8));
              i += 1 + oct.length;
              continue;
            }
            bytes.push(e.charCodeAt(0));
          } else if (e === '\r') {
            if (content[i + 2] === '\n') i++;
          } else if (e === undefined) {
            // конец
          } else {
            bytes.push(e.charCodeAt(0));
          }
          i += 2;
          continue;
        }
        if (c === '(') depth++;
        else if (c === ')') {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        bytes.push(content.charCodeAt(i) & 0xff);
        i++;
      }
      operands.push(Uint8Array.from(bytes));
      continue;
    }
    if (ch === '<' && content[i + 1] !== '<') {
      const end = content.indexOf('>', i);
      if (end === -1) break;
      operands.push(hexToBytes(content.slice(i + 1, end)));
      i = end + 1;
      continue;
    }
    if (ch === '<' && content[i + 1] === '<') {
      i += 2;
      continue;
    }
    if (ch === '>' && content[i + 1] === '>') {
      i += 2;
      continue;
    }
    if (ch === '[' || ch === ']') {
      i++;
      continue;
    }
    if (ch === '/' ) {
      let j = i + 1;
      while (j < n && !/[\s/[\]<>(){}]/.test(content[j])) j++;
      operands.push('/' + content.slice(i + 1, j));
      i = j;
      continue;
    }
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    // число или оператор
    let j = i;
    while (j < n && !/[\s/[\]<>(){}]/.test(content[j])) j++;
    const token = content.slice(i, j);
    i = j;
    if (token.length === 0) {
      // посторонний символ (бинарный мусор) — просто сдвигаемся, не зацикливаемся
      i += 1;
      continue;
    }
    if (/^[-+]?[\d.]+$/.test(token)) {
      operands.push(parseFloat(token));
      continue;
    }
    // оператор
    const nums = operands.filter((o): o is number => typeof o === 'number');
    switch (token) {
      case 'BT':
        lastY = null;
        break;
      case 'Tf': {
        const name = [...operands].reverse().find((o) => typeof o === 'string' && o.startsWith('/'));
        if (typeof name === 'string') {
          const f = fonts.get(name.slice(1));
          if (f) currentFont = f;
        }
        if (nums.length >= 1) fontSize = Math.abs(nums[nums.length - 1]) || 12;
        break;
      }
      case 'Tj':
      case "'": {
        if (token === "'") emitNewline(false);
        const s = [...operands].reverse().find((o) => o instanceof Uint8Array);
        if (s instanceof Uint8Array) show(s);
        break;
      }
      case '"': {
        emitNewline(false);
        const s = [...operands].reverse().find((o) => o instanceof Uint8Array);
        if (s instanceof Uint8Array) show(s);
        break;
      }
      case 'TJ': {
        // элементы-строки и kerning-числа чередуются; обходим стек по порядку
        let started = false;
        for (const op of operands) {
          if (op instanceof Uint8Array) {
            started = true;
            show(op);
          } else if (typeof op === 'number' && started && op <= -180) {
            out += ' ';
          }
        }
        break;
      }
      case 'Td': {
        if (nums.length >= 2) {
          const y = nums[nums.length - 1];
          if (y < 0) emitNewline(y <= -fontSize * 1.4);
          else if (lastY !== null && y !== 0) emitNewline(false);
          lastY = y;
        }
        break;
      }
      case 'TD': {
        if (nums.length >= 2) {
          const y = nums[nums.length - 1];
          if (y < 0) emitNewline(y <= -fontSize * 1.4);
          lastY = y;
        }
        break;
      }
      case 'T*':
        emitNewline(false);
        break;
      case 'Tm': {
        if (nums.length >= 6) {
          const y = nums[nums.length - 1];
          if (lastY !== null && y < lastY - 0.5) emitNewline(y <= lastY - fontSize * 1.4);
          lastY = y;
        }
        break;
      }
      default:
        break;
    }
    operands.length = 0;
  }
  return out;
}

// ------------------------------ Точка входа ------------------------------

function findRef(dict: string, key: string): number | null {
  const m = dict.match(new RegExp(`/${key}\\s+(\\d+)\\s+\\d+\\s+R`));
  return m ? parseInt(m[1], 10) : null;
}

function findInlineDict(dict: string, key: string): string | null {
  const m = dict.match(new RegExp(`/${key}\\s*<<([\\s\\S]*?)>>`));
  return m ? m[1] : null;
}

export function extractPdfText(bytes: Uint8Array): PdfExtractResult {
  const header = bytesToLatin1(bytes.subarray(0, 1024));
  const encrypted = /\/Encrypt\s+\d+\s+\d+\s+R/.test(bytesToLatin1(bytes.subarray(0, Math.min(bytes.length, 2_000_000))));
  if (!header.includes('%PDF')) {
    return { pages: [], title: '', encrypted };
  }

  const raw = bytesToLatin1(bytes);
  const objs = new Map<number, PdfObj>();
  collectObjects(raw, objs);

  // корень: trailer /Root или объект-каталог
  let rootNum: number | null = null;
  const trailerIdx = raw.lastIndexOf('trailer');
  if (trailerIdx !== -1) {
    rootNum = findRef(raw.slice(trailerIdx, trailerIdx + 2000), 'Root');
  }
  if (rootNum === null) {
    for (const obj of objs.values()) {
      if (/\/Type\s*\/Catalog/.test(obj.dict)) {
        rootNum = obj.num;
        break;
      }
    }
  }

  // шрифты по всем объектам (имя → FontInfo), привязка через /Resources страницы
  const fontInfoByObj = new Map<number, FontInfo>();
  const getFontInfo = (fontObjNum: number): FontInfo => {
    const cached = fontInfoByObj.get(fontObjNum);
    if (cached) return cached;
    const obj = objs.get(fontObjNum);
    let info: FontInfo = { cmap: null, hasIdentity: false };
    if (obj) {
      info.hasIdentity = /Identity-(H|V)|UTF16/.test(obj.dict);
      const toUnicode = findRef(obj.dict, 'ToUnicode');
      if (toUnicode !== null) {
        const cmapObj = objs.get(toUnicode);
        if (cmapObj?.data) {
          try {
            info.cmap = parseCMap(bytesToLatin1(cmapObj.data));
          } catch {
            info.cmap = null;
          }
        }
      }
      if (info.cmap && info.cmap.codeWidth === 1 && info.hasIdentity && info.cmap.map.size > 0) {
        // Identity-H с 1-байтным CMap — редкость, оставляем как есть
      }
    }
    fontInfoByObj.set(fontObjNum, info);
    return info;
  };

  const pages: string[] = [];
  const visited = new Set<number>();
  let pageCount = 0;
  let title = '';

  const resolveResources = (dict: string, inherited: Map<string, FontInfo> | null): Map<string, FontInfo> => {
    const fonts = new Map<string, FontInfo>(inherited ?? []);
    const fontRef = findRef(dict, 'Font');
    let fontDictText: string | null = null;
    if (fontRef !== null) {
      const fontDictObj = objs.get(fontRef);
      if (fontDictObj) fontDictText = fontDictObj.dict;
    } else {
      fontDictText = findInlineDict(dict, 'Font');
    }
    if (fontDictText) {
      const entryRe = /\/([A-Za-z0-9+.#-]+)\s+(\d+)\s+\d+\s+R/g;
      let m: RegExpExecArray | null;
      while ((m = entryRe.exec(fontDictText)) !== null) {
        const fontObjNum = parseInt(m[2], 10);
        fonts.set(m[1], getFontInfo(fontObjNum));
      }
    }
    return fonts;
  };

  const decodePage = (num: number, inheritedFonts: Map<string, FontInfo>): void => {
    if (visited.has(num) || pages.length > 5000) return;
    visited.add(num);
    const obj = objs.get(num);
    if (!obj) return;
    const dict = obj.dict;

    if (/\/Type\s*\/Pages/.test(dict)) {
      const fonts = resolveResources(dict, inheritedFonts);
      const kidsText = dict.match(/\/Kids\s*\[([^\]]*)\]/)?.[1] ?? '';
      const kidRe = /(\d+)\s+\d+\s+R/g;
      let m: RegExpExecArray | null;
      while ((m = kidRe.exec(kidsText)) !== null) decodePage(parseInt(m[1], 10), fonts);
      return;
    }
    if (!/\/Type\s*\/Page\b/.test(dict)) return;

    const fonts = resolveResources(dict, inheritedFonts);

    const contentRefs: number[] = [];
    const single = findRef(dict, 'Contents');
    if (single !== null) contentRefs.push(single);
    const arrText = dict.match(/\/Contents\s*\[([^\]]*)\]/)?.[1];
    if (arrText) {
      const refRe = /(\d+)\s+\d+\s+R/g;
      let m: RegExpExecArray | null;
      while ((m = refRe.exec(arrText)) !== null) contentRefs.push(parseInt(m[1], 10));
    }

    let pageText = '';
    for (const ref of contentRefs) {
      const contentObj = objs.get(ref);
      if (!contentObj?.data) continue;
      const t0 = Date.now();
      const decoded = decodeContentStream(bytesToLatin1(contentObj.data), fonts);
      pageText += decoded;
    }
    pageText = pageText
      .replace(/[ \t\u00A0]*\n[ \t\u00A0]*/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    pages.push(pageText);
  };

  if (rootNum !== null) {
    const catalog = objs.get(rootNum);
    const pagesNum = catalog ? findRef(catalog.dict, 'Pages') : null;
    if (pagesNum !== null) decodePage(pagesNum, new Map());
  }

  // /Info → Title
  const infoNumMatch = raw.slice(Math.max(0, trailerIdx - 2), trailerIdx + 2000).match(/Info\s+(\d+)\s+\d+\s+R/);
  const infoNum = infoNumMatch ? parseInt(infoNumMatch[1], 10) : null;
  if (infoNum !== null) {
    const info = objs.get(infoNum);
    if (info) {
      const lit = info.dict.match(/\/Title\s*\(([\s\S]*?)\)\s*[/>\]]/);
      const hex = info.dict.match(/\/Title\s*<([0-9a-fA-F\s]+)>/);
      if (hex) {
        const hb = hexToBytes(hex[1]);
        title =
          hb.length >= 2 && hb[0] === 0xfe && hb[1] === 0xff
            ? decodeUtf16BE(hb.subarray(2))
            : hb.length >= 2 && hb[0] === 0xff && hb[1] === 0xfe
              ? decodeUtf16LE(hb.subarray(2))
              : bytesToLatin1(hb);
      } else if (lit) {
        const lb = latin1ToBytes(lit[1]);
        title =
          lb.length >= 2 && lb[0] === 0xff && lb[1] === 0xfe
            ? decodeUtf16LE(lb.subarray(2))
            : lb.length >= 2 && lb[0] === 0xfe && lb[1] === 0xff
              ? decodeUtf16BE(lb.subarray(2))
              : decodeCp1251Bytes(lb);
      }
    }
  }

  return { pages, title: title.trim(), encrypted };
}
