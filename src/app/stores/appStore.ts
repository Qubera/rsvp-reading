/** Bootstrap приложения: инициализация хранилищ до показа UI. */

import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';
import { useLibraryStore } from './libraryStore';
import { useStatsStore } from './statsStore';

interface AppState {
  ready: boolean;
  init(): Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  ready: false,

  async init() {
    await Promise.all([
      useSettingsStore.getState().init(),
      useLibraryStore.getState().load(),
      useStatsStore.getState().load(),
    ]);
    set({ ready: true });
  },
}));
