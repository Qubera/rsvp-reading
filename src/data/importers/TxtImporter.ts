/** Импорт TXT: UTF-8 с фолбэком CP1251. */

import { decodeTextBytes } from '../../core/text/decode';

export interface TxtResult {
  text: string;
  encoding: 'utf8' | 'cp1251';
}

export function importTxt(bytes: Uint8Array): TxtResult {
  const { text, encoding } = decodeTextBytes(bytes);
  return { text: text.trim(), encoding };
}

export function titleFromFilename(name: string): string {
  return name
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_]+/g, ' ')
    .trim() || 'Без названия';
}
