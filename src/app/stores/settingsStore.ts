import { create } from 'zustand';
import {
  DEFAULT_SETTINGS,
  clampWpm,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  type UserSettings,
} from '../../core/models/UserSettings';
import { settingsRepo } from '../../data/repositories';

interface SettingsState {
  ready: boolean;
  settings: UserSettings;
  init(): Promise<void>;
  update(patch: Partial<UserSettings>): void;
  bumpWpm(delta: number): void;
  bumpFontSize(delta: number): void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSettingsSave(settings: UserSettings) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void settingsRepo.save(settings);
  }, 250);
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ready: false,
  settings: { ...DEFAULT_SETTINGS },

  async init() {
    const settings = await settingsRepo.load();
    set({ settings, ready: true });
  },

  update(patch) {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    scheduleSettingsSave(next);
  },

  bumpWpm(delta) {
    get().update({ wpm: clampWpm(get().settings.wpm + delta) });
  },

  bumpFontSize(delta) {
    const { fontSize } = get().settings;
    get().update({
      fontSize: Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, fontSize + delta)),
    });
  },
}));
