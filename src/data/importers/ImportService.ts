/**
 * ImportService: файл/TXT/PDF/EPUB/URL/буфер/ручной ввод → Document.
 * Единственная точка, где работает с файловой системой и сетью.
 */

import { Platform } from 'react-native';
import { File } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import type { Document, DocumentSource, DocumentType } from '../../core/models/types';
import { parseText } from '../../core/text/TextParser';
import { synthesizePages } from '../../core/text/pages';
import { generateId } from '../../core/utils/id';
import { importTxt, titleFromFilename } from './TxtImporter';
import { extractPdfText } from './PdfExtractor';
import { importEpub } from './EpubImporter';
import { importFb2, looksLikeFb2 } from './Fb2Importer';
import { importFromUrl } from './UrlImporter';
import { pageStartsFromPageTexts } from './importerPages';

export type ImportErrorCode =
  | 'PICK_CANCELED'
  | 'PICK_FAILED'
  | 'NO_TEXT'
  | 'INVALID_URL'
  | 'HTTP_ERROR'
  | 'NOT_HTML'
  | 'NETWORK'
  | 'EMPTY_CLIPBOARD'
  | 'ENCRYPTED_PDF'
  | 'UNSUPPORTED'
  | 'EPUB_BAD'
  | 'READ_FAILED';

export class ImportError extends Error {
  constructor(public code: ImportErrorCode, public details?: string) {
    super(code);
    this.name = 'ImportError';
  }
}

export interface NewDocumentInput {
  title: string;
  text: string;
  type: DocumentType;
  source: DocumentSource;
  /** реальные границы страниц (PDF), иначе синтетические */
  realPages?: number[];
}

export function buildDocument(input: NewDocumentInput): Document {
  const trimmed = input.text.replace(/\u00A0/g, ' ').trim();
  const parsed = parseText(trimmed);
  if (parsed.words.length < 3) throw new ImportError('NO_TEXT');
  const now = Date.now();
  return {
    id: generateId(),
    title: input.title.trim() || 'Без названия',
    type: input.type,
    source: input.source,
    text: trimmed,
    wordCount: parsed.words.length,
    currentWord: 0,
    progress: 0,
    status: 'new',
    pages: input.realPages && input.realPages.length > 1 ? input.realPages : synthesizePages(parsed.words.length),
    createdAt: now,
    updatedAt: now,
  };
}

async function readBytes(uri: string, webFile?: File | null): Promise<Uint8Array> {
  try {
    if (webFile) {
      return new Uint8Array(await webFile.arrayBuffer());
    }
    // web-пикер возвращает blob:/data: URI — читается через fetch
    if (/^(blob:|data:|https?:)/.test(uri)) {
      const res = await fetch(uri);
      return new Uint8Array(await res.arrayBuffer());
    }
    return await new File(uri).bytes();
  } catch (e) {
    throw new ImportError('READ_FAILED', String(e));
  }
}

function typeFromName(name: string, mime?: string): DocumentType {
  const lower = name.toLowerCase();
  if (lower.endsWith('.pdf') || mime === 'application/pdf') return 'pdf';
  if (lower.endsWith('.epub') || mime === 'application/epub+zip') return 'book';
  if (lower.endsWith('.txt') || lower.endsWith('.md') || (mime ?? '').startsWith('text/')) return 'text';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'article';
  return 'text';
}

/** Достаёт текст из байтов по типу. */
export async function importBytes(
  bytes: Uint8Array,
  fileName: string,
  mime?: string,
): Promise<{ title: string; text: string; type: DocumentType; realPages?: number[] }> {
  const type = typeFromName(fileName, mime);
  const lower = fileName.toLowerCase();

  // FB2 (FictionBook) — до «текстовых» форматов
  if (lower.endsWith('.fb2') || looksLikeFb2(bytes.subarray(0, 600))) {
    const fb2 = importFb2(bytes);
    if (parseText(fb2.text).words.length < 3) throw new ImportError('NO_TEXT');
    return {
      title: fb2.title || titleFromFilename(fileName),
      text: fb2.text,
      type: 'book',
    };
  }

  if (type === 'pdf') {
    const pdf = extractPdfText(bytes);
    if (pdf.encrypted) throw new ImportError('ENCRYPTED_PDF');
    const text = pdf.pages.map((p) => p.trim()).filter(Boolean).join('\n\n');
    if (parseText(text).words.length < 3) throw new ImportError('NO_TEXT');
    return {
      title: pdf.title || titleFromFilename(fileName),
      text,
      type: 'pdf',
      realPages: pageStartsFromPageTexts(pdf.pages),
    };
  }

  if (type === 'book') {
    try {
      const epub = importEpub(bytes);
      return { title: epub.title || titleFromFilename(fileName), text: epub.text, type: 'book' };
    } catch (e) {
      if (e instanceof ImportError) throw e;
      throw new ImportError('EPUB_BAD', String(e));
    }
  }

  // TXT / MD / HTML-файл
  const { text } = importTxt(bytes);
  if (type === 'article') {
    const { htmlToText } = await import('./html');
    const extracted = htmlToText(text);
    if (parseText(extracted.text).words.length < 3) throw new ImportError('NO_TEXT');
    return {
      title: extracted.title || titleFromFilename(fileName),
      text: extracted.text,
      type: 'article',
    };
  }
  if (parseText(text).words.length < 3) throw new ImportError('NO_TEXT');
  return { title: titleFromFilename(fileName), text, type: 'text' };
}


// отладочный доступ для проверки импорта в браузере (консоль: __rsvpImport)
if (Platform.OS === 'web') {
  (globalThis as unknown as Record<string, unknown>).__rsvpImport = async (buf: ArrayBuffer, name: string) => {
    const bytes = new Uint8Array(buf);
    const parsed = await importBytes(bytes, name);
    const doc = buildDocument({ ...parsed, source: 'file' });
    return { id: doc.id, title: doc.title, words: doc.wordCount };
  };
}

/** Выбор файла через системный пикер → Document. */
export async function importPickedFile(): Promise<Document> {
  const res = await DocumentPicker.getDocumentAsync({
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (res.canceled) throw new ImportError('PICK_CANCELED');
  const asset = res.assets[0];
  if (!asset) throw new ImportError('PICK_FAILED');
  const bytes = await readBytes(asset.uri, (asset as { file?: File }).file ?? null);
  const parsed = await importBytes(bytes, asset.name ?? 'document.txt', asset.mimeType);
  return buildDocument({ ...parsed, source: 'file' });
}

/** Веб-страница по URL. */
export async function importUrlFlow(url: string): Promise<Document> {
  let parsed;
  try {
    parsed = await importFromUrl(url);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    if (msg.startsWith('INVALID_URL')) throw new ImportError('INVALID_URL');
    if (msg.startsWith('HTTP_')) throw new ImportError('HTTP_ERROR', msg);
    if (msg.startsWith('NOT_HTML')) throw new ImportError('NOT_HTML');
    if (msg.startsWith('NO_TEXT')) throw new ImportError('NO_TEXT');
    throw new ImportError('NETWORK', msg);
  }
  return buildDocument({ title: parsed.title, text: parsed.text, type: 'article', source: 'url' });
}

/** Текст из буфера обмена. */
export async function importClipboardFlow(): Promise<Document> {
  const text = await Clipboard.getStringAsync();
  if (!text || text.trim().length < 3) throw new ImportError('EMPTY_CLIPBOARD');
  const firstLine = text.trim().split('\n').find((l) => l.trim().length > 0) ?? '';
  const title = firstLine.length > 3 && firstLine.length <= 80 ? firstLine.trim() : 'Из буфера обмена';
  return buildDocument({ title, text, type: 'text', source: 'clipboard' });
}

/** Ручной ввод/вставка текста. */
export async function importTypedFlow(title: string, text: string): Promise<Document> {
  return buildDocument({
    title: title.trim() || 'Без названия',
    text,
    type: 'text',
    source: 'clipboard',
  });
}
