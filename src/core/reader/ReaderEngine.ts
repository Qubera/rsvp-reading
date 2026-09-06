/**
 * ReaderEngine — ядро RSVP-чтения.
 *
 * Отвечает ТОЛЬКО за тайминг и выдачу индекса текущего слова.
 * Никакого UI, никакого хранения состояния приложения.
 *
 * Принцип работы: расписание задано в безразмерных «юнитах» (unitEnd),
 * реальное время вычисляется как unit * k, где k = 60000 / wpm.
 * Поэтому:
 *  - смена скорости мгновенна даже для книги на 500k слов (O(1));
 *  - нет дрейфа, свойственного цепочке setTimeout;
 *  - seek/пауза/возобновление точны до кадра.
 *
 * Такт двигателя — requestAnimationFrame (инъекция для тестов).
 */

import type { Timeline } from '../text/Timeline';

export type ReaderState = 'idle' | 'playing' | 'paused' | 'finished';

export interface FrameScheduler {
  request(cb: () => void): number;
  cancel(id: number): void;
}

const rafScheduler: FrameScheduler = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (id) => cancelAnimationFrame(id),
};

export interface ReaderEngineOptions {
  wpm: number;
  startIndex?: number;
  clock?: () => number;
  scheduler?: FrameScheduler;
}

export class ReaderEngine {
  private timeline: Timeline;
  private clock: () => number;
  private sched: FrameScheduler;
  private k: number;

  private state: ReaderState = 'idle';
  private index: number;
  /** «Виртуальные часы» в юнитах на паузе */
  private pausedUnits = 0;
  private anchorTime = 0;
  private anchorUnits = 0;
  private frameId: number | null = null;

  private wordCbs = new Set<(index: number) => void>();
  private stateCbs = new Set<(state: ReaderState) => void>();

  constructor(timeline: Timeline, opts: ReaderEngineOptions) {
    this.timeline = timeline;
    this.clock = opts.clock ?? (() => performance.now());
    this.sched = opts.scheduler ?? rafScheduler;
    this.k = 60000 / opts.wpm;
    const start = Math.max(0, Math.min(opts.startIndex ?? 0, Math.max(0, timeline.size - 1)));
    this.index = start;
    this.pausedUnits = this.startUnitOf(start);
  }

  // --- Подписки ---

  onWord(cb: (index: number) => void): () => void {
    this.wordCbs.add(cb);
    return () => this.wordCbs.delete(cb);
  }

  onStateChange(cb: (state: ReaderState) => void): () => void {
    this.stateCbs.add(cb);
    return () => this.stateCbs.delete(cb);
  }

  // --- Состояние ---

  get currentState(): ReaderState {
    return this.state;
  }

  get currentIndex(): number {
    return this.index;
  }

  get size(): number {
    return this.timeline.size;
  }

  /** Слово по индексу (для отображения). */
  wordAt(i: number): string {
    return this.timeline.words[i] ?? '';
  }

  get wpm(): number {
    return Math.round(60000 / this.k);
  }

  /** Юнит-время начала слова i. */
  startUnitOf(i: number): number {
    return i <= 0 ? 0 : this.timeline.unitEnd[Math.min(i, this.timeline.size) - 1];
  }

  /** Прошедшее время чтения в юнитах. */
  unitsElapsed(): number {
    if (this.state === 'playing') {
      return this.anchorUnits + (this.clock() - this.anchorTime) / this.k;
    }
    return this.pausedUnits;
  }

  /** Время начала слова i в мс от начала воспроизведения. */
  timeForIndex(i: number): number {
    return this.startUnitOf(i) * this.k;
  }

  progress(): { index: number; size: number; percent: number } {
    const size = this.timeline.size;
    return {
      index: this.index,
      size,
      percent: size === 0 ? 0 : Math.min(1, (this.index + 1) / size),
    };
  }

  // --- Управление ---

  play(): void {
    if (this.state === 'playing' || this.timeline.size === 0) return;
    if (this.state === 'finished') {
      this.index = 0;
      this.pausedUnits = 0;
    }
    if (this.pausedUnits < this.startUnitOf(this.index) - 1e-9) {
      this.pausedUnits = this.startUnitOf(this.index);
    }
    if (this.pausedUnits >= this.timeline.totalUnits && this.timeline.totalUnits > 0) {
      this.pausedUnits = 0;
      this.index = 0;
    }
    this.anchorUnits = this.pausedUnits;
    this.anchorTime = this.clock();
    this.setState('playing');
    this.scheduleFrame();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.pausedUnits = this.unitsElapsed();
    this.cancelFrame();
    this.index = this.findIndex(Math.min(this.pausedUnits, this.timeline.totalUnits));
    this.setState('paused');
    this.emitWord(this.index);
  }

  toggle(): void {
    if (this.state === 'playing') this.pause();
    else this.play();
  }

  /** Смена скорости на лету: положение сохраняется точно. */
  setWpm(wpm: number): void {
    const clamped = Math.min(1500, Math.max(100, wpm));
    const wasPlaying = this.state === 'playing';
    if (wasPlaying) {
      this.pausedUnits = this.unitsElapsed();
      this.cancelFrame();
    }
    this.k = 60000 / clamped;
    if (wasPlaying) {
      this.anchorUnits = this.pausedUnits;
      this.anchorTime = this.clock();
      this.scheduleFrame();
    }
  }

  seekToIndex(i: number, emit = true): void {
    const clamped = Math.max(0, Math.min(Math.round(i), Math.max(0, this.timeline.size - 1)));
    this.index = clamped;
    this.pausedUnits = this.startUnitOf(clamped);
    if (this.state === 'playing') {
      this.anchorUnits = this.pausedUnits;
      this.anchorTime = this.clock();
    } else if (this.state === 'finished' && clamped < this.timeline.size - 1) {
      this.setState('paused');
    }
    if (emit) this.emitWord(clamped);
  }

  seekBy(delta: number): void {
    this.seekToIndex(this.index + delta);
  }

  /** Индекс начала предложения, содержащего слово i. */
  sentenceStart(i: number): number {
    for (let k = i - 1; k >= 0; k--) {
      if (this.timeline.sentenceEnd[k] === 1) return k + 1;
    }
    return 0;
  }

  nextSentence(): void {
    const { sentenceEnd, size } = this.timeline;
    for (let k = this.index; k < size; k++) {
      if (sentenceEnd[k] === 1) {
        this.seekToIndex(Math.min(k + 1, Math.max(0, size - 1)));
        return;
      }
    }
    this.seekToIndex(Math.max(0, size - 1));
  }

  previousSentence(): void {
    const start = this.sentenceStart(this.index);
    if (this.index - start <= 2) {
      // уже в начале предложения — перейти к предыдущему
      this.seekToIndex(this.sentenceStart(Math.max(0, start - 1)));
    } else {
      this.seekToIndex(start);
    }
  }

  /** Подмена таймлайна (например, при смене пауз) с сохранением позиции. */
  replaceTimeline(timeline: Timeline): void {
    this.timeline = timeline;
    const idx = Math.min(this.index, Math.max(0, timeline.size - 1));
    this.index = idx;
    this.pausedUnits = this.startUnitOf(idx);
    if (this.state === 'playing') {
      this.anchorUnits = this.pausedUnits;
      this.anchorTime = this.clock();
      this.scheduleFrame();
    }
    this.emitWord(idx);
  }

  destroy(): void {
    this.cancelFrame();
    this.wordCbs.clear();
    this.stateCbs.clear();
  }

  // --- Внутреннее ---

  private setState(s: ReaderState): void {
    if (this.state === s) return;
    this.state = s;
    this.stateCbs.forEach((cb) => cb(s));
  }

  private emitWord(index: number): void {
    this.wordCbs.forEach((cb) => cb(index));
  }

  private scheduleFrame(): void {
    if (this.frameId !== null) return;
    this.frameId = this.sched.request(this.loop);
  }

  private cancelFrame(): void {
    if (this.frameId !== null) {
      this.sched.cancel(this.frameId);
      this.frameId = null;
    }
  }

  private findIndex(units: number): number {
    const { unitEnd, size } = this.timeline;
    if (size === 0) return 0;
    let lo = 0;
    let hi = size - 1;
    if (units >= unitEnd[size - 1]) return size - 1;
    if (units < unitEnd[0]) return 0;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (unitEnd[mid] > units) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  private loop = (): void => {
    this.frameId = null;
    if (this.state !== 'playing') return;
    const total = this.timeline.totalUnits;
    const elapsed = this.unitsElapsed();
    if (elapsed >= total) {
      this.index = Math.max(0, this.timeline.size - 1);
      this.pausedUnits = total;
      this.setState('finished');
      this.emitWord(this.index);
      return;
    }
    const idx = this.findIndex(elapsed);
    if (idx !== this.index) {
      this.index = idx;
      this.emitWord(idx);
    }
    this.scheduleFrame();
  };
}
