export type ThemeSetting = 'system' | 'dark' | 'black' | 'ocean' | 'light' | 'sepia';
export type LanguageSetting = 'system' | 'ru' | 'kk' | 'en';
export type WordSpacingLevel = 'low' | 'medium' | 'high';
export type PunctuationPauseLevel = 'short' | 'normal' | 'long';
export type FontId = 'inter' | 'manrope' | 'literata' | 'jetbrains';

export const WPM_MIN = 100;
export const WPM_MAX = 1500;
export const FONT_SIZE_MIN = 24;
export const FONT_SIZE_MAX = 120;

export interface UserSettings {
  onboarded: boolean;
  wpm: number;
  font: FontId;
  fontSize: number;
  textColor: string;
  backgroundColor: string;
  /** цвет опорной (выделенной) буквы */
  pivotColor: string;
  wordSpacing: WordSpacingLevel;
  punctuationPause: PunctuationPauseLevel;
  orpEnabled: boolean;
  theme: ThemeSetting;
  language: LanguageSetting;
  notifications: boolean;
  currentDocumentId: string | null;
}

export const DEFAULT_SETTINGS: UserSettings = {
  onboarded: false,
  wpm: 400,
  font: 'inter',
  fontSize: 40,
  textColor: '#FFFFFF',
  backgroundColor: '#0A0E1A',
  pivotColor: '#4F8DFD',
  wordSpacing: 'medium',
  punctuationPause: 'normal',
  orpEnabled: true,
  theme: 'dark',
  language: 'system',
  notifications: false,
  currentDocumentId: null,
};

export const WORD_SPACING_FACTOR: Record<WordSpacingLevel, number> = {
  low: 0,
  medium: 0.15,
  high: 0.32,
};

export const PUNCTUATION_MULTIPLIER: Record<PunctuationPauseLevel, number> = {
  short: 0.6,
  normal: 1,
  long: 1.7,
};

export function clampWpm(wpm: number): number {
  if (!Number.isFinite(wpm)) return DEFAULT_SETTINGS.wpm;
  return Math.min(WPM_MAX, Math.max(WPM_MIN, Math.round(wpm)));
}
