/**
 * Декодирование текстовых файлов без DOM/TextDecoder:
 * UTF-8 (вручную) + CP1251 (частая кодировка русскоязычных TXT).
 */

export function decodeUtf8(bytes: Uint8Array): { text: string; errors: number } {
  let i = 0;
  let errors = 0;
  let out = '';
  const n = bytes.length;
  if (n >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) i = 3;

  while (i < n) {
    const b = bytes[i];
    if (b < 0x80) {
      out += String.fromCharCode(b);
      i++;
      continue;
    }
    let len: number;
    let cp: number;
    if (b >= 0xc2 && b <= 0xdf) {
      len = 1;
      cp = b & 0x1f;
    } else if (b >= 0xe0 && b <= 0xef) {
      len = 2;
      cp = b & 0x0f;
    } else if (b >= 0xf0 && b <= 0xf4) {
      len = 3;
      cp = b & 0x07;
    } else {
      errors++;
      out += '\uFFFD';
      i++;
      continue;
    }
    if (i + len >= n + 1 || i + len > n - 1 + 1) {
      // проверка ниже по байтам продолжения; здесь только границы
    }
    let ok = true;
    for (let k = 1; k <= len; k++) {
      const cb = bytes[i + k];
      if (cb === undefined || (cb & 0xc0) !== 0x80) {
        ok = false;
        break;
      }
      cp = (cp << 6) | (cb & 0x3f);
    }
    i += len + 1;
    if (!ok) {
      errors++;
      out += '\uFFFD';
      continue;
    }
    if (cp > 0x10ffff) {
      errors++;
      out += '\uFFFD';
      continue;
    }
    if (cp > 0xffff) {
      cp -= 0x10000;
      out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      out += String.fromCharCode(cp);
    }
  }
  return { text: out, errors };
}

const CP1251_HIGH =
  '\u0402\u0403\u201A\u0453\u201E\u2026\u2020\u2021\u20AC\u2030\u0409\u2039\u040A\u040C\u040B\u040F' + // 0x80-0x8F
  '\u0452\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u0020\u2122\u0459\u203A\u045A\u045C\u045B\u045F' + // 0x90-0x9F
  '\u00A0\u040E\u045E\u0408\u00A4\u0490\u00A6\u00A7\u0401\u00A9\u0404\u00AB\u00AC\u00AD\u00AE\u0407' + // 0xA0-0xAF
  '\u00B0\u00B1\u0406\u0456\u0491\u00B5\u00B6\u00B7\u0451\u2116\u0454\u00BB\u0458\u0405\u0455\u0457' + // 0xB0-0xBF
  '\u0410\u0411\u0412\u0413\u0414\u0415\u0416\u0417\u0418\u0419\u041A\u041B\u041C\u041D\u041E\u041F' + // 0xC0-0xCF
  '\u0420\u0421\u0422\u0423\u0424\u0425\u0426\u0427\u0428\u0429\u042A\u042B\u042C\u042D\u042E\u042F' + // 0xD0-0xDF
  '\u0430\u0431\u0432\u0433\u0434\u0435\u0436\u0437\u0438\u0439\u043A\u043B\u043C\u043D\u043E\u043F' + // 0xE0-0xEF
  '\u0440\u0441\u0442\u0443\u0444\u0445\u0446\u0447\u0448\u0449\u044A\u044B\u044C\u044D\u044E\u044F'; // 0xF0-0xFF

export function decodeWindows1251(bytes: Uint8Array): string {
  let out = '';
  const n = bytes.length;
  for (let i = 0; i < n; i++) {
    const b = bytes[i];
    if (b < 0x80) out += String.fromCharCode(b);
    else out += CP1251_HIGH[b - 0x80];
  }
  return out;
}

export interface DecodedText {
  text: string;
  encoding: 'utf8' | 'cp1251';
}

/** UTF-8 с фолбэком на CP1251 при битых последовательностях. */
export function decodeTextBytes(bytes: Uint8Array): DecodedText {
  const utf = decodeUtf8(bytes);
  if (utf.errors === 0) return { text: utf.text, encoding: 'utf8' };
  return { text: decodeWindows1251(bytes), encoding: 'cp1251' };
}
