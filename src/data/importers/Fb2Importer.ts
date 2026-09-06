/**
 * Импорт FB2 (FictionBook XML): название из <book-title>,
 * текст из <body> (абзацы <p>/<v>), base64-картинки <binary> выбрасываются.
 */

import { decodeEntities } from './html';
import { decodeTextBytes } from '../../core/text/decode';

export interface Fb2Result {
  title: string;
  text: string;
}

export function looksLikeFb2(bytes: Uint8Array): boolean {
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 600));
  return /<\?xml[\s\S]{0,300}?<FictionBook/i.test(head) || /<FictionBook/i.test(head);
}

export function importFb2(bytes: Uint8Array): Fb2Result {
  const xml = decodeTextBytes(bytes).text;

  // название — до зачистки тегов
  const titleMatch = xml.match(/<book-title[^>]*>([\s\S]*?)<\/book-title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : '';

  // выбрасываем base64-картинки и стили — иначе они попадают в текст
  let s = xml
    .replace(/<binary[\s\S]*?<\/binary>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');

  const bodyMatch = s.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : s;

  // абзацы: <p> и стихи <v> → переносы; остальные теги — прочь
  body = body
    .replace(/<\/(p|v)>/gi, '\n')
    .replace(/<(p|v)[^>]*>/gi, '\n')
    .replace(/<empty-line\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const paragraphs = body
    .split('\n')
    .map((l) => decodeEntities(l.replace(/[ \t\u00A0]+/g, ' ').trim()))
    .filter((l) => l.length > 0 && !/^[\s*−–—-]*$/.test(l));

  if (paragraphs.length === 0) throw new Error('FB2: текст не найден');

  return { title, text: paragraphs.join('\n\n') };
}
