/** Импорт EPUB: unzip (fflate) → OPF/spine → XHTML → текст. */

import { unzipSync } from 'fflate';
import { decodeUtf8 } from '../../core/text/decode';
import { htmlToText } from './html';

export interface EpubResult {
  title: string;
  author: string;
  text: string;
}

function decode(bytes: Uint8Array): string {
  return decodeUtf8(bytes).text;
}

function resolvePath(base: string, href: string): string {
  const clean = href.split('#')[0];
  if (clean.startsWith('/')) return clean.slice(1);
  const baseDir = base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '';
  const parts = (baseDir + clean).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '' || p === '.') continue;
    if (p === '..') out.pop();
    else out.push(p);
  }
  return out.join('/');
}

export function importEpub(bytes: Uint8Array): EpubResult {
  const files = unzipSync(bytes);

  // container.xml → путь к OPF
  let opfPath = '';
  const container = files['META-INF/container.xml'];
  if (container) {
    const m = decode(container).match(/full-path=["']([^"']+)["']/);
    if (m) opfPath = m[1];
  }
  if (!opfPath) {
    const fallback = Object.keys(files).find((k) => k.endsWith('.opf'));
    opfPath = fallback ?? '';
  }
  if (!opfPath || !files[opfPath]) {
    throw new Error('EPUB: OPF не найден');
  }

  const opf = decode(files[opfPath]);
  const title = opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1]?.trim() ?? '';
  const author = opf.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i)?.[1]?.trim() ?? '';

  // manifest: id → href
  const manifest = new Map<string, string>();
  const itemRe = /<item\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = itemRe.exec(opf)) !== null) {
    const tag = m[0];
    const id = tag.match(/id=["']([^"']+)["']/i)?.[1];
    const href = tag.match(/href=["']([^"']+)["']/i)?.[1];
    const media = tag.match(/media-type=["']([^"']+)["']/i)?.[1] ?? '';
    if (id && href && (media.includes('xhtml') || media.includes('html') || href.match(/\.x?html?$/i))) {
      manifest.set(id, href);
    }
  }

  // spine: порядок чтения
  const chapters: string[] = [];
  const idrefs: string[] = [];
  const spineMatch = opf.match(/<spine\b[^>]*>([\s\S]*?)<\/spine>/i);
  if (spineMatch) {
    const refRe = /<itemref\b[^>]*idref=["']([^"']+)["']/gi;
    let r: RegExpExecArray | null;
    while ((r = refRe.exec(spineMatch[1])) !== null) idrefs.push(r[1]);
  }
  if (idrefs.length === 0) {
    // фолбэк: все xhtml из manifest по порядку
    for (const href of manifest.values()) idrefs.push(href);
  }

  for (const idref of idrefs) {
    const href = manifest.get(idref);
    if (!href) continue;
    const path = resolvePath(opfPath, href);
    const data = files[path];
    if (!data) continue;
    const { text } = htmlToText(decode(data));
    if (text.trim()) chapters.push(text.trim());
  }

  if (chapters.length === 0) throw new Error('EPUB: текст не найден');

  return {
    title: title.trim() || 'Книга',
    author: author.trim(),
    text: chapters.join('\n\n'),
  };
}
