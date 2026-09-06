import { create } from 'zustand';
import type { Document, DocumentMeta } from '../../core/models/types';
import { documentRepo } from '../../data/repositories';

type LibraryCategory = 'all' | 'book' | 'article' | 'pdf' | 'other';

interface LibraryState {
  docs: DocumentMeta[];
  ready: boolean;
  load(): Promise<void>;
  upsert(doc: Document): void;
  remove(id: string): Promise<void>;
  rename(id: string, title: string): Promise<void>;
  metaOf(id: string): DocumentMeta | undefined;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  docs: [],
  ready: false,

  async load() {
    const docs = await documentRepo.list();
    set({ docs, ready: true });
  },

  upsert(doc) {
    // сохраняем в базу: импорт должен переживать перезапуск приложения
    void documentRepo.save(doc).catch(() => undefined);
    const { text: _t, ...meta } = doc;
    const rest = get().docs.filter((d) => d.id !== doc.id);
    set({ docs: [meta, ...rest].sort((a, b) => b.updatedAt - a.updatedAt) });
  },

  async remove(id) {
    await documentRepo.delete(id);
    set({ docs: get().docs.filter((d) => d.id !== id) });
  },

  async rename(id, title) {
    await documentRepo.rename(id, title);
    set({
      docs: get()
        .docs.map((d) => (d.id === id ? { ...d, title: title.trim() || d.title, updatedAt: Date.now() } : d))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    });
  },

  metaOf(id) {
    return get().docs.find((d) => d.id === id);
  },
}));

export function categoryOf(type: DocumentMeta['type']): LibraryCategory {
  if (type === 'book' || type === 'article' || type === 'pdf') return type;
  return 'other';
}
