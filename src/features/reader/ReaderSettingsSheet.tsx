import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet, WpmSlider, SettingRow, Segmented, Button, ColorWheel } from '../../ui/components';
import { useTheme, UI_FONT_MEDIUM, UI_FONT_SEMIBOLD, READER_FONTS } from '../../ui/theme/ThemeProvider';
import { useI18n } from '../../core/i18n/I18nProvider';
import { useSettingsStore } from '../../app/stores/settingsStore';
import { useReaderStore } from '../../app/stores/readerStore';
import {
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  type FontId,
  type PunctuationPauseLevel,
  type WordSpacingLevel,
} from '../../core/models/UserSettings';

/** акцентные цвета для опорной буквы */
const PIVOT_SWATCHES = ['#4F8DFD', '#8B5CF6', '#38BDF8', '#7DF9A6', '#F5A623', '#F4574D', '#FFFFFF', '#E8EEFF'];
import { haptic } from '../../services/haptics/Haptics';

const FONT_OPTIONS: { id: FontId; label: string }[] = [
  { id: 'inter', label: 'Inter' },
  { id: 'manrope', label: 'Manrope' },
  { id: 'literata', label: 'Literata' },
  { id: 'jetbrains', label: 'JetBrains Mono' },
];

type WheelKind = null | 'text' | 'bg' | 'pivot';

export function ReaderSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const s = useSettingsStore((st) => st.settings);
  const update = useSettingsStore((st) => st.update);
  const applyTiming = useReaderStore((st) => st.applyTiming);
  const [wheel, setWheel] = useState<WheelKind>(null);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('reader_settings')}>
      <View style={{ gap: 16 }}>
        {/* Скорость */}
        <WpmSlider
          label={t('settings_wpm')}
          value={s.wpm}
          min={100}
          max={1500}
          onChange={(v) => update({ wpm: v })}
          unit={t('stats_wpm_unit')}
        />

        {/* Шрифт */}
        <View>
          <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 14, marginBottom: 8 }}>
            {t('reader_font')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {FONT_OPTIONS.map((f) => {
              const active = s.font === f.id;
              return (
                <Pressable
                  key={f.id}
                  onPress={() => {
                    haptic.selection();
                    update({ font: f.id });
                  }}
                  style={{
                    paddingHorizontal: 16,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: active ? colors.accent : colors.surfaceAlt,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: active ? colors.onAccent : colors.text,
                      fontFamily: READER_FONTS[f.id].regular,
                      fontSize: 15,
                    }}
                  >
                    {f.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Размер текста */}
        <WpmSlider
          label={t('reader_font_size')}
          value={s.fontSize}
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          onChange={(v) => update({ fontSize: v })}
          unit="pt"
        />

        {/* Цвета чтения: круглая палитра */}
        <View style={{ borderRadius: 16, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
          <SettingRow
            icon="color-filter-outline"
            label={t('reader_text_color')}
            right={<SwatchDot color={s.textColor} />}
            onPress={() => setWheel('text')}
          />
          <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />
          <SettingRow
            icon="contrast-outline"
            label={t('reader_bg_color')}
            right={<SwatchDot color={s.backgroundColor} />}
            onPress={() => setWheel('bg')}
          />
          <View style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />
          <SettingRow
            icon="locate-outline"
            label={t('settings_pivot_color')}
            right={<SwatchDot color={s.pivotColor} />}
            onPress={() => setWheel('pivot')}
          />
        </View>

        {/* Интервал между словами */}        {/* Интервал между словами */}
        <View>
          <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 14, marginBottom: 8 }}>
            {t('reader_word_gap')}
          </Text>
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
        </View>

        {/* Пауза после пунктуации */}
        <View>
          <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 14, marginBottom: 8 }}>
            {t('reader_punct_pause')}
          </Text>
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
        </View>

        {/* Переключатели */}
        <View style={{ borderRadius: 16, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}>
          <SettingRow
            icon="locate-outline"
            label={t('reader_orp')}
            sub={t('reader_orp_hint')}
            right={<Toggle value={s.orpEnabled} onChange={(v) => update({ orpEnabled: v })} />}
          />
        </View>
      </View>

      <Sheet
        visible={wheel !== null}
        onClose={() => setWheel(null)}
        title={
          wheel === 'text'
            ? t('reader_text_color')
            : wheel === 'bg'
              ? t('reader_bg_color')
              : t('settings_pivot_color')
        }
      >
        <ColorWheel
          initialColor={
            wheel === 'text' ? s.textColor : wheel === 'bg' ? s.backgroundColor : s.pivotColor
          }
          onChange={(hex: string) => {
            if (wheel === 'text') update({ textColor: hex });
            else if (wheel === 'bg') update({ backgroundColor: hex });
            else update({ pivotColor: hex });
          }}
        />
        <View style={{ height: 8 }} />
        <Button label={t('common_done')} icon="checkmark" onPress={() => setWheel(null)} />
      </Sheet>
    </Sheet>
  );
}

function SwatchDot({ color }: { color: string }) {
  const { colors } = useTheme();
  return (
    <View
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

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        onChange(!value);
      }}
      hitSlop={8}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{
        width: 50,
        height: 30,
        borderRadius: 999,
        backgroundColor: value ? colors.accent : colors.borderStrong,
        padding: 3,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 999,
          backgroundColor: '#fff',
          transform: [{ translateX: value ? 20 : 0 }],
        }}
      />
    </Pressable>
  );
}

export { Toggle };
