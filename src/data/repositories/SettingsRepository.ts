/** SettingsRepository: единый JSON-объект настроек. */

import { DEFAULT_SETTINGS, type UserSettings } from '../../core/models/UserSettings';
import { kvGetJson, kvSetJson } from '../../storage/kv';

const KEY = 'settings';

export class SettingsRepository {
  async load(): Promise<UserSettings> {
    const saved = await kvGetJson<Partial<UserSettings>>(KEY);
    if (!saved) return { ...DEFAULT_SETTINGS };
    // merge поверх дефолтов — устойчив к добавлению новых полей
    return { ...DEFAULT_SETTINGS, ...saved };
  }

  async save(settings: UserSettings): Promise<void> {
    await kvSetJson(KEY, settings);
  }
}
