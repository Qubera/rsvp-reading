/**
 * FullTextScreen — «Весь текст»: документ как обычная страница.
 * Нажатие на любое слово продолжает RSVP-чтение с него. Текущая позиция
 * выделена. Для длинных книг текст подгружается порциями (кнопка «ещё»).
 */

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, UI_FONT_MEDIUM, UI_FONT_SEMIBOLD, READER_FONTS } from '../../ui/theme/ThemeProvider';
import { useI18n } from '../../core/i18n/I18nProvider';
import { useSettingsStore } from '../../app/stores/settingsStore';
import { getOpenParsed, useReaderStore } from '../../app/stores/readerStore';
import { buildBlocks } from '../../core/text/TextParser';
import { formatNumber } from '../../core/utils/format';
import type { RootStackParamList } from '../../app/navigation/RootNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'FullText'>;

const PORTION = 60; // блоков за раз

export function FullTextScreen() {
  const { colors } = useTheme();
  const { t } = useI18n();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const settings = useSettingsStore((s) => s.settings);
  const seekIndex = useReaderStore((s) => s.seekIndex);
  const offset = useReaderStore((s) => s.offset);
  const index = useReaderStore((s) => s.index);
  const size = useReaderStore((s) => s.size);

  const parsed = getOpenParsed();
  const blocks = useMemo(() => (parsed ? buildBlocks(parsed, 30) : []), [parsed]);
  const [shown, setShown] = useState(PORTION);

  const fontFamily = READER_FONTS[settings.font].regular;
  const currentGlobal = offset + index;

  const jumpTo = (globalIdx: number) => {
    // индекс внутри текущего среза чтения
    const local = globalIdx - offset;
    if (local >= 0 && local < size) {
      seekIndex(local);
      nav.goBack();
    }
  };

  if (!parsed) return null;

  const visibleBlocks = blocks.slice(0, shown);

  const renderWord = (globalIdx: number, word: string, isLast: boolean) => {
    const isCurrent = globalIdx === currentGlobal;
    return (
      <Text
        key={globalIdx}
        onPress={() => jumpTo(globalIdx)}
        style={{
          color: isCurrent ? colors.accent : colors.textSecondary,
          fontWeight: isCurrent ? '700' : '400',
          opacity: isCurrent ? 1 : 0.85,
        }}
      >
        {word}
        {!isLast ? ' ' : ''}
      </Text>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: settings.backgroundColor }}>
      {/* Шапка */}
      <View
        style={{
          paddingTop: insets.top + 6,
          paddingHorizontal: 10,
          paddingBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={settings.textColor} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ color: settings.textColor, fontFamily: UI_FONT_SEMIBOLD, fontSize: 15 }}>
            {t('reader_full_text')}
          </Text>
          <Text numberOfLines={1} style={{ color: settings.textColor, fontFamily: UI_FONT_MEDIUM, fontSize: 11, opacity: 0.5 }}>
            {t('fulltext_hint')}
          </Text>
        </View>
        <Text style={{ color: settings.textColor, fontFamily: UI_FONT_MEDIUM, fontSize: 12, opacity: 0.6, fontVariant: ['tabular-nums'] }}>
          {formatNumber(currentGlobal + 1)} / {formatNumber(size)}
        </Text>
      </View>

      <ScrollView showsVerticalScrollIndicator contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 40 }}>
        {visibleBlocks.map((b) => (
          <View key={b.start} style={{ marginBottom: b.paragraphStart && b.start !== visibleBlocks[0].start ? 14 : 2 }}>
            <Text
              style={{
                fontFamily,
                fontSize: Math.max(15, Math.min(24, settings.fontSize * 0.6)),
                lineHeight: Math.round(Math.max(15, Math.min(24, settings.fontSize * 0.6)) * 1.6),
                color: settings.textColor,
              }}
            >
              {Array.from({ length: b.end - b.start }, (_, k) =>
                renderWord(b.start + k, parsed.words[b.start + k] ?? '', k === b.end - b.start - 1),
              )}
            </Text>
          </View>
        ))}

        {shown < blocks.length ? (
          <Pressable
            onPress={() => setShown((v) => v + PORTION)}
            style={{
              alignSelf: 'center',
              marginTop: 14,
              paddingHorizontal: 22,
              paddingVertical: 12,
              borderRadius: 14,
              backgroundColor: colors.surfaceAlt,
            }}
          >
            <Text style={{ color: colors.text, fontFamily: UI_FONT_SEMIBOLD, fontSize: 14 }}>
              {t('fulltext_more')}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}
