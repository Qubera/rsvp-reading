export type DocumentType = 'book' | 'article' | 'pdf' | 'text';
export type DocumentStatus = 'new' | 'reading' | 'completed';
export type DocumentSource = 'file' | 'url' | 'clipboard' | 'ocr' | 'sample';

export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  source: DocumentSource;
  text: string;
  wordCount: number;
  /** Индекс последнего показанного слова. */
  currentWord: number;
  /** 0..1 */
  progress: number;
  status: DocumentStatus;
  /** Индекс первого слова каждой «страницы» (для PDF — реальные страницы). */
  pages: number[] | null;
  createdAt: number;
  updatedAt: number;
}

/** Документ без текста — для списков (лёгкий). */
export type DocumentMeta = Omit<Document, 'text'>;

export interface ReadingSession {
  id: string;
  documentId: string;
  startedAt: number;
  finishedAt: number | null;
  wordsRead: number;
  durationMs: number;
  avgWpm: number;
  maxWpm: number;
}

export function documentTypeLabel(type: DocumentType): 'book' | 'article' | 'pdf' | 'text' {
  return type;
}
