import { create } from 'zustand';
import type { ReadingSession } from '../../core/models/types';
import { statisticsRepo } from '../../data/repositories';

interface StatsState {
  sessions: ReadingSession[];
  ready: boolean;
  load(): Promise<void>;
}

export const useStatsStore = create<StatsState>((set) => ({
  sessions: [],
  ready: false,

  async load() {
    const sessions = await statisticsRepo.listAll();
    set({ sessions, ready: true });
  },
}));
