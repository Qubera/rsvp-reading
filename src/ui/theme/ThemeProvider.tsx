import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { RADIUS, THEMES, type Palette } from './palette';
import { useSettingsStore } from '../../app/stores/settingsStore';
import type { FontId } from '../../core/models/UserSettings';

export interface FontPair {
  regular: string;
  bold: string;
}

/** Семейство шрифтов для ридера по FontId (имена из expo-google-fonts). */
export const READER_FONTS: Record<FontId, FontPair> = {
  inter: { regular: 'Inter_400Regular', bold: 'Inter_700Bold' },
  manrope: { regular: 'Manrope_400Regular', bold: 'Manrope_700Bold' },
  literata: { regular: 'Literata_400Regular', bold: 'Literata_700Bold' },
  jetbrains: { regular: 'JetBrainsMono_400Regular', bold: 'JetBrainsMono_700Bold' },
};

export const UI_FONT_REGULAR = 'Inter_400Regular';
export const UI_FONT_MEDIUM = 'Inter_500Medium';
export const UI_FONT_SEMIBOLD = 'Inter_600SemiBold';
export const UI_FONT_BOLD = 'Inter_700Bold';

interface ThemeContextValue {
  colors: Palette;
  radius: typeof RADIUS;
}

const ThemeContext = createContext<ThemeContextValue>({ colors: THEMES.dark, radius: RADIUS });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSettingsStore((s) => s.settings.theme);
  const system = useColorScheme();
  const colors = useMemo(() => {
    if (theme === 'system') return (system ?? 'dark') === 'light' ? THEMES.light : THEMES.dark;
    return THEMES[theme] ?? THEMES.dark;
  }, [theme, system]);

  const value = useMemo(() => ({ colors, radius: RADIUS }), [colors]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
