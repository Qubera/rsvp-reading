/**
 * readerStore: связывает Document → TextParser → Timeline → ReaderEngine.
 * UI только рендерит то, что лежит здесь; вся логика — здесь и в core.
 */

import { create } from 'zustand';
import type { DocumentStatus } from '../../core/models/types';
import {
  PUNCTUATION_MULTIPLIER,
  WORD_SPACING_FACTOR,
  type UserSettings,
} from '../../core/models/UserSettings';
import { ReaderEngine, type ReaderState as EngineState } from '../../core/reader/ReaderEngine';
import { parseText, type ParsedText } from '../../core/text/TextParser';
import {
  buildTimeline,
  sliceTimeline,
  type Timeline,
  type TimingProfile,
} from '../../core/text/Timeline';
import { generateId } from '../../core/utils/id';
import { documentRepo, statisticsRepo } from '../../data/repositories';
import { useLibraryStore } from './libraryStore';
import { useSettingsStore } from './settingsStore';
import { useStatsStore } from './statsStore';

export function timingProfileFromSettings(s: UserSettings): TimingProfile {
  return {
    wordSpacing: WORD_SPACING_FACTOR[s.wordSpacing],
    punctuationMultiplier: PUNCTUATION_MULTIPLIER[s.punctuationPause],
    paragraphMultiplier: 0.85,
  };
}

export interface ReaderRange {
  /** включительно */
  from: number;
  /** исключительно */
  to: number;
}

export interface FinishedInfo {
  wordsRead: number;
  ms: number;
  wpm: number;
}

interface SessionTracker {
  id: string;
  documentId: string;
  startedAt: number;
  playingMs: number;
  lastPlayStart: number | null;
  wordsBase: number;
  maxIndexReached: number;
  maxWpm: number;
}

interface ReaderStoreState {
  docId: string | null;
  docTitle: string;
  wordCount: number; // слов во всём документе
  offset: number; // начало среза (в координатах документа)
  rangeEnd: number; // конец среза
  size: number; // размер среза
  index: number; // позиция в срезе
  engineState: EngineState;
  finishedInfo: FinishedInfo | null;
  engine: ReaderEngine | null;

  open(docId: string, range?: Partial<ReaderRange>): Promise<boolean>;
  play(): void;
  pause(): void;
  toggle(): void;
  nextSentence(): void;
  prevSentence(): void;
  seekIndex(i: number): void;
  seekFraction(f: number): void;
  restart(): void;
  setWpmLive(wpm: number): void;
  /** пересборка тайминга после смены интервалов/пауз */
  applyTiming(): void;
  close(): void;
  /** зафиксировать сессию и прогресс (например, при уходе в фон) */
  flush(): void;
}

// Кэш разобранного текста открытого документа (не в zustand — он большой).
let openParsed: ParsedText | null = null;
let session: SessionTracker | null = null;
let lastSaveIndex = -1;
let lastSaveAt = 0;

const AUTOSAVE_WORDS = 24;
const AUTOSAVE_MS = 3000;

function patchLibraryMeta(docId: string, patch: Partial<{ currentWord: number; progress: number; status: DocumentStatus; updatedAt: number }>) {
  useLibraryStore.setState((s) => ({
    docs: s.docs.map((d) => (d.id === docId ? { ...d, ...patch } : d)),
  }));
}

export const useReaderStore = create<ReaderStoreState>((set, get) => {
  const docProgress = (state: ReaderStoreState): { currentWord: number; progress: number } => {
    const current = state.offset + state.index;
    return {
      currentWord: current,
      progress: state.wordCount === 0 ? 0 : Math.min(1, (current + 1) / state.wordCount),
    };
  };

  const saveProgress = (status?: DocumentStatus) => {
    const st = get();
    if (!st.docId) return;
    const { currentWord, progress } = docProgress(st);
    if (currentWord === lastSaveIndex && status === undefined) return;
    lastSaveIndex = currentWord;
    lastSaveAt = Date.now();
    const nextStatus: DocumentStatus = status ?? (progress >= 0.999 ? 'completed' : currentWord > 0 ? 'reading' : 'new');
    void documentRepo.updateProgress(st.docId, currentWord, progress, nextStatus);
    patchLibraryMeta(st.docId, { currentWord, progress, status: nextStatus, updatedAt: Date.now() });
  };

  const ensureSession = () => {
    const st = get();
    if (!st.docId || session) return;
    session = {
      id: generateId(),
      documentId: st.docId,
      startedAt: Date.now(),
      playingMs: 0,
      lastPlayStart: Date.now(),
      wordsBase: st.index,
      maxIndexReached: st.index,
      maxWpm: useSettingsStore.getState().settings.wpm,
    };
  };

  const stopPlayClock = () => {
    if (session && session.lastPlayStart !== null) {
      session.playingMs += Date.now() - session.lastPlayStart;
      session.lastPlayStart = null;
    }
  };

  const finalizeSession = () => {
    const st = get();
    stopPlayClock();
    if (!session || !st.docId) {
      session = null;
      return;
    }
    const wordsRead = Math.max(0, session.maxIndexReached - session.wordsBase);
    const durationMs = session.playingMs;
    const started = session;
    session = null;
    if (wordsRead > 0 && durationMs >= 2000) {
      const wpm = Math.round(wordsRead / (durationMs / 60000));
      void statisticsRepo
        .add({
          id: started.id,
          documentId: started.documentId,
          startedAt: started.startedAt,
          finishedAt: Date.now(),
          wordsRead,
          durationMs,
          avgWpm: wpm,
          maxWpm: Math.max(started.maxWpm, wpm),
        })
        .then(() => useStatsStore.getState().load())
        .catch(() => undefined);
    }
  };

  const maybeAutosave = () => {
    const st = get();
    if (st.index - lastSaveIndex >= AUTOSAVE_WORDS || Date.now() - lastSaveAt >= AUTOSAVE_MS) {
      saveProgress();
    }
  };

  return {
    docId: null,
    docTitle: '',
    wordCount: 0,
    offset: 0,
    rangeEnd: 0,
    size: 0,
    index: 0,
    engineState: 'idle',
    finishedInfo: null,
    engine: null,

    async open(docId, range) {
      const settings = useSettingsStore.getState().settings;
      const doc = await documentRepo.get(docId);
      if (!doc) return false;

      const parsed = parseText(doc.text);
      openParsed = parsed;
      const total = parsed.words.length;
      const fromDefault = doc.status === 'completed' ? 0 : Math.min(doc.currentWord, Math.max(0, total - 1));
      const from = Math.max(0, Math.min(range?.from ?? fromDefault, total - 1));
      const to = Math.max(from + 1, Math.min(range?.to ?? total, total));

      const fullTimeline = buildTimeline(parsed, timingProfileFromSettings(settings));
      const sliced = sliceTimeline(fullTimeline, from, to);
      lastSaveIndex = -1;
      lastSaveAt = 0;
      session = null;

      const engine = new ReaderEngine(sliced.timeline, {
        wpm: settings.wpm,
        startIndex: 0,
      });
      const timeline = sliced.timeline;

      engine.onWord((index) => {
        if (session && index > session.maxIndexReached) session.maxIndexReached = index;
        set({ index });
        maybeAutosave();
      });

      engine.onStateChange((state) => {
        if (state === 'playing') {
          ensureSession();
        } else if (state === 'paused') {
          stopPlayClock();
        } else if (state === 'finished') {
          const st = get();
          stopPlayClock();
          const wordsRead = session ? Math.max(0, Math.max(session.maxIndexReached, st.index) - session.wordsBase) : st.index;
          const ms = session ? session.playingMs : 0;
          const wholeDoc = st.offset === 0 && st.rangeEnd >= st.wordCount;
          const info: FinishedInfo = {
            wordsRead,
            ms,
            wpm: ms > 0 ? Math.round(wordsRead / (ms / 60000)) : 0,
          };
          finalizeSession();
          saveProgress(wholeDoc ? 'completed' : 'reading');
          set({ finishedInfo: info, engineState: 'finished' });
          return;
        }
        set({ engineState: state });
      });

      get().engine?.destroy();
      set({
        docId,
        docTitle: doc.title,
        wordCount: doc.wordCount || total,
        offset: from,
        rangeEnd: to,
        size: sliced.timeline.size,
        index: engine.currentIndex,
        engineState: engine.currentState,
        finishedInfo: null,
        engine,
      });
      useSettingsStore.getState().update({ currentDocumentId: docId });
      return true;
    },

    play() {
      const st = get();
      if (st.engineState === 'finished') set({ finishedInfo: null });
      st.engine?.play();
    },

    pause() {
      get().engine?.pause();
      saveProgress();
    },

    toggle() {
      const st = get();
      if (st.engineState === 'playing') st.pause();
      else get().play();
    },

    nextSentence() {
      get().engine?.nextSentence();
      saveProgress();
    },

    prevSentence() {
      get().engine?.previousSentence();
      saveProgress();
    },

    seekIndex(i) {
      get().engine?.seekToIndex(i);
      set({ index: get().engine?.currentIndex ?? i, finishedInfo: null });
      saveProgress();
    },

    seekFraction(f) {
      const st = get();
      const idx = Math.round(Math.max(0, Math.min(1, f)) * Math.max(0, st.size - 1));
      get().seekIndex(idx);
    },

    restart() {
      set({ finishedInfo: null });
      get().seekIndex(0);
      get().play();
    },

    setWpmLive(wpm) {
      get().engine?.setWpm(wpm);
      useSettingsStore.getState().update({ wpm });
      if (session) session.maxWpm = Math.max(session.maxWpm, wpm);
    },

    applyTiming() {
      const st = get();
      if (!openParsed) return;
      const settings = useSettingsStore.getState().settings;
      const full = buildTimeline(openParsed, timingProfileFromSettings(settings));
      const sliced = sliceTimeline(full, st.offset, st.rangeEnd);
      st.engine?.replaceTimeline(sliced.timeline);
      set({ size: sliced.timeline.size, index: st.engine?.currentIndex ?? 0 });
    },

    close() {
      const st = get();
      if (st.engineState === 'playing') st.engine?.pause();
      finalizeSession();
      saveProgress();
      st.engine?.destroy();
      openParsed = null;
      session = null;
      set({
        docId: null,
        engine: null,
        index: 0,
        size: 0,
        offset: 0,
        rangeEnd: 0,
        wordCount: 0,
        engineState: 'idle',
        finishedInfo: null,
      });
    },

    flush() {
      const st = get();
      if (!st.docId) return;
      if (st.engineState === 'playing') st.engine?.pause();
      saveProgress();
    },
  };
});

/** Разобранный текст открытого документа (для Focus Reading). */
export function getOpenParsed(): ParsedText | null {
  return openParsed;
}

/** Оценка оставшегося времени (мс) при текущей скорости. */
export function remainingMs(state: { engine: ReaderEngine | null; index: number; size: number }): number {
  const engine = state.engine;
  if (!engine) return 0;
  const total = engine.timeForIndex(state.size - 1);
  const passed = engine.timeForIndex(state.index);
  return Math.max(0, total - passed);
}
