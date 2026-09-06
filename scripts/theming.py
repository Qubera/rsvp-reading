# -*- coding: utf-8 -*-
"""Темы интерфейса (5 вариантов + системная) и удаление пресетов цветов."""
import io, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def rd(p):
    return io.open(os.path.join(ROOT, p), encoding='utf-8').read()

def wr(p, s):
    io.open(os.path.join(ROOT, p), 'w', encoding='utf-8', newline='').write(s)

def patch(p, pairs):
    s = rd(p)
    for old, new in pairs:
        assert old in s, p + ': ' + repr(old[:70])
        s = s.replace(old, new, 1)
    wr(p, s)
    print('ok', p)

# 1) palette.ts: ThemeId + THEMES, удалить пресеты
s = rd('src/ui/theme/palette.ts')
old_presets = s[s.index('/** Пресеты цветов чтения'):s.index('export const RADIUS')]
s = s.replace(old_presets, '')
s = s.replace(
    "/** Палитры: тёмная — основная (по референсу), светлая — альтернатива. */",
    """/** Палитры тем интерфейса. */

export type ThemeId = 'dark' | 'black' | 'ocean' | 'light' | 'sepia';
export type ThemeSetting = ThemeId | 'system';""",
)
wr('src/ui/theme/palette.ts', s)
print('ok palette head')

# вставить THEMES после LIGHT
s = rd('src/ui/theme/palette.ts')
anchor = "export const RADIUS = {"
themes = """/** Варианты тёмной темы: классическая, OLED-чёрная, глубокий синий. */
function tintDark(base: {
  bg: string; bgGradient: [string, string]; surface: string; surfaceAlt: string;
  surfaceHover: string; border: string; borderStrong: string; tabBar: string;
  tabBarBorder: string; skeleton: string; chartBarDim: string; overlay: string;
}): Palette {
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

"""
s = s.replace(anchor, themes + anchor, 1)
wr('src/ui/theme/palette.ts', s)
print('ok THEMES')

