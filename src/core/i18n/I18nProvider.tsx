import React, { createContext, useContext, useMemo } from 'react';
import * as Localization from 'expo-localization';
import type { LanguageSetting } from '../models/UserSettings';
import { TRANSLATIONS, type TranslationKeys } from './translations';
import { useSettingsStore } from '../../app/stores/settingsStore';

export type Lang = 'ru' | 'kk' | 'en';

interface I18nContextValue {
  lang: Lang;
  t: (key: keyof TranslationKeys, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'ru',
  t: (key) => String(key),
});

function systemLang(): Lang {
  const code = Localization.getLocales()[0]?.languageCode ?? 'ru';
  if (code === 'kk' || code === 'ru') return code;
  return 'en';
}

export function resolveLang(setting: LanguageSetting): Lang {
  if (setting === 'system') return systemLang();
  return setting;
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useSettingsStore((s) => s.settings.language);
  const lang = resolveLang(language);

  const value = useMemo<I18nContextValue>(() => {
    const dict = TRANSLATIONS[lang];
    const t = (key: keyof TranslationKeys, params?: Record<string, string | number>) => {
      let s = (dict[key] ?? TRANSLATIONS.ru[key] ?? String(key)) as string;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        }
      }
      return s;
    };
    return { lang, t };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
