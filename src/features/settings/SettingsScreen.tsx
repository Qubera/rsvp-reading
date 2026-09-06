import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '../../ui/components/Screen';
import { Button, Card, SectionTitle, SettingRow, Sheet, WpmSlider, Segmented } from '../../ui/components';
import { Toggle } from '../reader/ReaderSettingsSheet';
import { useTheme, UI_FONT_BOLD, UI_FONT_MEDIUM, READER_FONTS } from '../../ui/theme/ThemeProvider';
import { Ionicons } from '@expo/vector-icons';
import { useI18n } from '../../core/i18n/I18nProvider';
import { useSettingsStore } from '../../app/stores/settingsStore';
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  type FontId,
  type LanguageSetting,
  type PunctuationPauseLevel,
  type ThemeSetting,
  type WordSpacingLevel,
} from '../../core/models/UserSettings';
import { ColorWheel } from '../../ui/components/ColorWheel';
import { useReaderStore } from '../../app/stores/readerStore';
import { readingReminder } from '../../services/notifications/ReadingReminder';
import { haptic } from '../../services/haptics/Haptics';

const FONT_OPTIONS: { id: FontId; label: string }[] = [
  { id: 'inter', label: 'Inter' },
  { id: 'manrope', label: 'Manrope' },
  { id: 'literata', label: 'Literata' },
  { id: 'jetbrains', label: 'JetBrains Mono' },
];

type SheetKind = null | 'wpm' | 'font' | 'textColor' | 'bgColor' | 'pivotColor' | 'gap' | 'punct' | 'theme' | 'lang';

export function SettingsScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const s = useSettingsStore((st) => st.settings);
  const ready = useSettingsStore((st) => st.ready);
  const update = useSettingsStore((st) => st.update);
  const applyTiming = useReaderStore((st) => st.applyTiming);
  const [sheet, setSheet] = useState<SheetKind>(null);

  // Уведомления: ежедневное напоминание в 20:00 (браузерное на web, системное на телефоне)
  useEffect(() => {
    if (!ready) return;
    if (!s.notifications) {
      void readingReminder.disable();
      return;
    }
    void (async () => {
      const granted = await readingReminder.enable();
      if (!granted) update({ notifications: false });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.notifications, ready]);

  const fontLabel = FONT_OPTIONS.find((f) => f.id === s.font)?.label ?? '';
  const gapLabel = t(`reader_gap_${s.wordSpacing === 'low' ? 'low' : s.wordSpacing === 'medium' ? 'medium' : 'high'}` as never);
  const punctLabel = t(
    `reader_punct_${s.punctuationPause === 'short' ? 'short' : s.punctuationPause === 'normal' ? 'normal' : 'long'}` as never,
  );
  const themeLabel = t(`settings_theme_${s.theme}` as never);
  const langLabel = s.language === 'system' ? t('settings_lang_system') : t(`settings_lang_${s.language}` as never);
  const currentFontName = FONT_OPTIONS.find((f) => f.id === s.font)?.label ?? 'Inter';

  return (
    <Screen>
      <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 28, marginBottom: 16 }}>
        {t('settings_title')}
      </Text>

      <SectionTitle>{t('settings_reading')}</SectionTitle>
      <Card style={{ paddingVertical: 4, marginBottom: 20 }}>
        <SettingRow icon="speedometer-outline" label={t('settings_wpm')} value={String(s.wpm)} onPress={() => setSheet('wpm')} />
        <Divider />
        <SettingRow
          icon="text-outline"
          label={t('settings_font')}
          value={`${currentFontName} · ${s.fontSize} pt`}
          onPress={() => setSheet('font')}
        />
        <Divider />
        <SettingRow
          icon="color-filter-outline"
          label={t('settings_text_color')}
          right={<Swatch color={s.textColor} onPress={() => setSheet('textColor')} />}
          onPress={() => setSheet('textColor')}
        />
        <Divider />
        <SettingRow
          icon="contrast-outline"
          label={t('settings_bg_color')}
          right={<Swatch color={s.backgroundColor} onPress={() => setSheet('bgColor')} />}
          onPress={() => setSheet('bgColor')}
        />
        <Divider />
        <SettingRow
          icon="locate-outline"
          label={t('settings_pivot_color')}
          right={<Swatch color={s.pivotColor} onPress={() => setSheet('pivotColor')} />}
          onPress={() => setSheet('pivotColor')}
        />
        <Divider />
        <SettingRow icon="resize-outline" label={t('settings_word_gap')} value={gapLabel} onPress={() => setSheet('gap')} />
        <Divider />
        <SettingRow icon="time-outline" label={t('reader_punct_pause')} value={punctLabel} onPress={() => setSheet('punct')} />
      </Card>

      <SectionTitle>{t('settings_other')}</SectionTitle>
      <Card style={{ paddingVertical: 4, marginBottom: 20 }}>
        <SettingRow
          icon="notifications-outline"
          label={t('settings_notifications')}
          sub={t('settings_notifications_hint')}
          right={<Toggle value={s.notifications} onChange={(v) => update({ notifications: v })} />}
        />
        <Divider />
        <SettingRow icon="moon-outline" label={t('settings_theme')} value={themeLabel} onPress={() => setSheet('theme')} />
        <Divider />
        <SettingRow icon="language-outline" label={t('settings_language')} value={langLabel} onPress={() => setSheet('lang')} />
      </Card>

      <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
        {t('settings_about')}
      </Text>

      {/* ---- Шиты ---- */}
      <Sheet visible={sheet === 'wpm'} onClose={() => setSheet(null)} title={t('settings_wpm')}>
        <WpmSlider
          value={s.wpm}
          min={100}
          max={1500}
          onChange={(v) => update({ wpm: v })}
          unit={t('stats_wpm_unit')}
        />
      </Sheet>

      <Sheet visible={sheet === 'font'} onClose={() => setSheet(null)} title={t('settings_font')}>
        <View style={{ gap: 16 }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {FONT_OPTIONS.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => {
                  haptic.selection();
                  update({ font: f.id });
                }}
                style={{
                  paddingHorizontal: 18,
                  height: 44,
                  borderRadius: 13,
                  backgroundColor: s.font === f.id ? colors.accent : colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: s.font === f.id ? colors.onAccent : colors.text, fontFamily: READER_FONTS[f.id].regular, fontSize: 15 }}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <WpmSlider
            label={t('reader_font_size')}
            value={s.fontSize}
            min={FONT_SIZE_MIN}
            max={FONT_SIZE_MAX}
            onChange={(v) => update({ fontSize: v })}
            unit="pt"
          />
        </View>
      </Sheet>

      <ColorSheet
        visible={sheet === 'textColor' || sheet === 'bgColor' || sheet === 'pivotColor'}
        onClose={() => setSheet(null)}
        title={
          sheet === 'textColor'
            ? t('settings_text_color')
            : sheet === 'pivotColor'
              ? t('settings_pivot_color')
              : t('settings_bg_color')
        }
        current={sheet === 'pivotColor' ? s.pivotColor : sheet === 'textColor' ? s.textColor : s.backgroundColor}
        onPick={(hex) => {
          if (sheet === 'textColor') update({ textColor: hex });
          else if (sheet === 'pivotColor') update({ pivotColor: hex });
          else update({ backgroundColor: hex });
        }}
      />

      <Sheet visible={sheet === 'gap'} onClose={() => setSheet(null)} title={t('settings_word_gap')}>
        <Segmented<WordSpacingLevel>
          value={s.wordSpacing}
          onChange={(v) => {
            update({ wordSpacing: v });
            applyTiming();
          }}
          options={[
            { key: 'low', label: t('reader_gap_low') },
            { key: 'medium', label: t('reader_gap_medium') },
            { key: 'high', label: t('reader_gap_high') },
          ]}
        />
      </Sheet>

      <Sheet visible={sheet === 'punct'} onClose={() => setSheet(null)} title={t('reader_punct_pause')}>
        <Segmented<PunctuationPauseLevel>
          value={s.punctuationPause}
          onChange={(v) => {
            update({ punctuationPause: v });
            applyTiming();
          }}
          options={[
            { key: 'short', label: t('reader_punct_short') },
            { key: 'normal', label: t('reader_punct_normal') },
            { key: 'long', label: t('reader_punct_long') },
          ]}
        />
      </Sheet>

      <Sheet visible={sheet === 'theme'} onClose={() => setSheet(null)} title={t('settings_theme')}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(
            [
              ['system', t('settings_theme_system')],
              ['dark', t('settings_theme_dark')],
              ['black', t('settings_theme_black')],
              ['ocean', t('settings_theme_ocean')],
              ['light', t('settings_theme_light')],
              ['sepia', t('settings_theme_sepia')],
            ] as [ThemeSetting, string][]
          ).map(([key, label]) => {
            const active = s.theme === key;
            return (
              <Pressable
                key={key}
                onPress={() => {
                  haptic.selection();
                  update({ theme: key });
                }}
                style={{
                  paddingHorizontal: 16,
                  height: 42,
                  borderRadius: 13,
                  backgroundColor: active ? colors.accent : colors.surfaceAlt,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: active ? colors.onAccent : colors.text, fontFamily: UI_FONT_MEDIUM, fontSize: 14 }}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>

      <Sheet visible={sheet === 'lang'} onClose={() => setSheet(null)} title={t('settings_language')}>
        <Segmented<LanguageSetting>
          value={s.language}
          onChange={(v) => update({ language: v })}
          options={[
            { key: 'ru', label: t('settings_lang_ru') },
            { key: 'kk', label: t('settings_lang_kk') },
            { key: 'en', label: t('settings_lang_en') },
          ]}
        />
      </Sheet>
    </Screen>
  );
}

function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />;
}

function Swatch({ color, onPress }: { color: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      style={{
        width: 28,
        height: 28,
        borderRadius: 999,
        backgroundColor: color,
        borderWidth: 2,
        borderColor: colors.borderStrong,
      }}
    />
  );
}

function ColorSheet({
  visible,
  onClose,
  title,
  current,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  current: string;
  onPick: (hex: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ColorWheel initialColor={current} onChange={onPick} />
      <View style={{ height: 8 }} />
      <Button label={t('common_done')} icon="checkmark" onPress={onClose} />
    </Sheet>
  );
}
