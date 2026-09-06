/** Палитры тем интерфейса. */

export type ThemeId = 'dark' | 'black' | 'ocean' | 'light' | 'sepia';
export type ThemeSetting = ThemeId | 'system';

export interface Palette {
  isDark: boolean;
  bg: string;
  bgGradient: [string, string];
  surface: string;
  surfaceAlt: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentPressed: string;
  accentSoft: string;
  accent2: string;
  onAccent: string;
  success: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  tabBar: string;
  tabBarBorder: string;
  overlay: string;
  skeleton: string;
  chartBar: string;
  chartBarDim: string;
}

export const DARK: Palette = {
  isDark: true,
  bg: '#070B15',
  bgGradient: ['#0A1020', '#070B15'],
  surface: '#101828',
  surfaceAlt: '#151E33',
  surfaceHover: '#1A2440',
  border: 'rgba(148, 163, 199, 0.10)',
  borderStrong: 'rgba(148, 163, 199, 0.18)',
  text: '#F2F5FB',
  textSecondary: '#8E99B4',
  textTertiary: '#5C6784',
  accent: '#4F8DFD',
  accentPressed: '#3B78E8',
  accentSoft: 'rgba(79, 141, 253, 0.15)',
  accent2: '#8B5CF6',
  onAccent: '#FFFFFF',
  success: '#34C77B',
  danger: '#F4574D',
  dangerSoft: 'rgba(244, 87, 77, 0.14)',
  warning: '#F5A623',
  tabBar: '#0A0F1D',
  tabBarBorder: 'rgba(148, 163, 199, 0.08)',
  overlay: 'rgba(4, 7, 14, 0.6)',
  skeleton: 'rgba(148, 163, 199, 0.08)',
  chartBar: '#4F8DFD',
  chartBarDim: 'rgba(79, 141, 253, 0.25)',
};

export const LIGHT: Palette = {
  isDark: false,
  bg: '#F4F6FB',
  bgGradient: ['#EEF1F9', '#F7F9FD'],
  surface: '#FFFFFF',
  surfaceAlt: '#F1F4FA',
  surfaceHover: '#E9EEF7',
  border: 'rgba(23, 32, 64, 0.08)',
  borderStrong: 'rgba(23, 32, 64, 0.14)',
  text: '#141B2D',
  textSecondary: '#5A6478',
  textTertiary: '#98A1B5',
  accent: '#2F6BE4',
  accentPressed: '#2459C6',
  accentSoft: 'rgba(47, 107, 228, 0.10)',
  accent2: '#7C5CF6',
  onAccent: '#FFFFFF',
  success: '#1FA96A',
  danger: '#E14B41',
  dangerSoft: 'rgba(225, 75, 65, 0.10)',
  warning: '#D98A0B',
  tabBar: '#FFFFFF',
  tabBarBorder: 'rgba(23, 32, 64, 0.07)',
  overlay: 'rgba(20, 27, 45, 0.35)',
  skeleton: 'rgba(23, 32, 64, 0.06)',
  chartBar: '#2F6BE4',
  chartBarDim: 'rgba(47, 107, 228, 0.20)',
};

/** Варианты тёмной темы: классическая, OLED-чёрная, глубокий синий. */
function tintDark(base: Partial<Palette>): Palette {
  return { ...DARK, ...base };
}

export const THEMES: Record<ThemeId, Palette> = {
  dark: DARK,
  black: tintDark({
    bg: '#000000',
    bgGradient: ['#000000', '#000000'],
    surface: '#0B0B10',
    surfaceAlt: '#131318',
    surfaceHover: '#1B1B22',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',
    tabBar: '#050507',
    tabBarBorder: 'rgba(255,255,255,0.06)',
    skeleton: 'rgba(255,255,255,0.06)',
    chartBarDim: 'rgba(79, 141, 253, 0.18)',
    overlay: 'rgba(0,0,0,0.65)',
  }),
  ocean: tintDark({
    bg: '#071022',
    bgGradient: ['#0A1730', '#071022'],
    surface: '#0D1B38',
    surfaceAlt: '#12234A',
    surfaceHover: '#182C5C',
    border: 'rgba(120, 170, 255, 0.12)',
    borderStrong: 'rgba(120, 170, 255, 0.22)',
    tabBar: '#081226',
    tabBarBorder: 'rgba(120, 170, 255, 0.10)',
    skeleton: 'rgba(120, 170, 255, 0.08)',
    chartBarDim: 'rgba(56, 189, 248, 0.25)',
    accent: '#38BDF8',
    accentPressed: '#1FA8E0',
    accentSoft: 'rgba(56, 189, 248, 0.15)',
    overlay: 'rgba(2, 8, 20, 0.6)',
  }),
  light: LIGHT,
  sepia: {
    ...LIGHT,
    bg: '#F6EEDD',
    bgGradient: ['#F1E7D0', '#FAF3E3'],
    surface: '#FFF9EC',
    surfaceAlt: '#EFE4CC',
    surfaceHover: '#E7D9BC',
    border: 'rgba(90, 70, 40, 0.12)',
    borderStrong: 'rgba(90, 70, 40, 0.2)',
    text: '#3E3226',
    textSecondary: '#7A6A52',
    textTertiary: '#A5946F',
    accent: '#B4632C',
    accentPressed: '#98501F',
    accentSoft: 'rgba(180, 99, 44, 0.14)',
    danger: '#C0453A',
    dangerSoft: 'rgba(192, 69, 58, 0.12)',
    tabBar: '#FBF4E4',
    tabBarBorder: 'rgba(90, 70, 40, 0.1)',
    skeleton: 'rgba(90, 70, 40, 0.08)',
    chartBar: '#B4632C',
    chartBarDim: 'rgba(180, 99, 44, 0.22)',
    overlay: 'rgba(62, 50, 38, 0.35)',
  },
};

export const RADIUS = { card: 20, sheet: 24, button: 16, chip: 999, icon: 14 } as const;
export const SPACING = (n: number) => n * 4;

/** Пресеты цветов чтения (текст/фон), доступны в ридере и настройках. */
export interface ReaderColorPreset {
  id: string;
  text: string;
  bg: string;
  label: string;
}

export const READER_COLOR_PRESETS: ReaderColorPreset[] = [
  { id: 'night', text: '#FFFFFF', bg: '#070B15', label: 'Ночь' },
  { id: 'navy', text: '#E8EEFF', bg: '#0E1630', label: 'Navy' },
  { id: 'ink', text: '#111111', bg: '#FFFFFF', label: 'Бумага' },
  { id: 'sepia', text: '#433422', bg: '#F1E7D0', label: 'Сепия' },
  { id: 'matrix', text: '#7DF9A6', bg: '#04140B', label: 'Matrix' },
];
