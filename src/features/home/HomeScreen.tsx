import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, EmptyState, IconButton } from '../../ui/components';
import { useTheme, UI_FONT_BOLD, UI_FONT_MEDIUM, UI_FONT_SEMIBOLD } from '../../ui/theme/ThemeProvider';
import { useI18n } from '../../core/i18n/I18nProvider';
import { useLibraryStore } from '../../app/stores/libraryStore';
import { useSettingsStore } from '../../app/stores/settingsStore';
import { useStatsStore } from '../../app/stores/statsStore';
import { useReaderStore } from '../../app/stores/readerStore';
import { aggregateSessions } from '../../domain/stats/aggregate';
import { formatNumber, wordsLabel } from '../../core/utils/format';
import type { RootStackParamList } from '../../app/navigation/RootNavigator';
import type { DocumentMeta } from '../../core/models/types';
import { DocumentTypeIcon } from '../library/DocIcon';
import { ReaderView } from '../reader/ReaderView';
import { Screen } from '../../ui/components/Screen';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function greetingKey(hour: number): string {
  if (hour < 5) return 'home_greeting_evening';
  if (hour < 12) return 'home_greeting_morning';
  if (hour < 18) return 'home_greeting_day';
  return 'home_greeting_evening';
}

export function HomeScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const nav = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const docs = useLibraryStore((s) => s.docs);
  const sessions = useStatsStore((s) => s.sessions);
  const currentDocId = useSettingsStore((s) => s.settings.currentDocumentId);
  const readerBg = useSettingsStore((s) => s.settings.backgroundColor);
  const [immersive, setImmersive] = useState(false);
  const chromeFade = useRef(new Animated.Value(1)).current;
  const applyImmersive = (v: boolean) => {
    setImmersive(v);
    Animated.timing(chromeFade, { toValue: v ? 0 : 1, duration: 200, useNativeDriver: true }).start();
  };
  const engineDocId = useReaderStore((s) => s.docId);
  const openReader = useReaderStore((s) => s.open);
  const flush = useReaderStore((s) => s.flush);

  const current = useMemo<DocumentMeta | undefined>(
    () => docs.find((d) => d.id === currentDocId) ?? docs.find((d) => d.status !== 'completed'),
    [docs, currentDocId],
  );

  // Автоподгрузка активного документа в ридер (как на референсе — ридер на главной)
  useEffect(() => {
    if (current && engineDocId === null) {
      void openReader(current.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, engineDocId]);

  useEffect(() => () => flush(), [flush]);

  const todayWords = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return sessions.filter((s) => s.startedAt >= d.getTime()).reduce((a, s) => a + s.wordsRead, 0);
  }, [sessions]);

  const summary = useMemo(() => aggregateSessions(sessions, 'all'), [sessions]);

  return (
    <View style={{ flex: 1, backgroundColor: readerBg, paddingTop: insets.top }}>
      <Animated.View
        pointerEvents={immersive ? 'none' : 'auto'}
        style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', gap: 10, opacity: chromeFade }}
      >
        <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 22, flex: 1 }}>
          {t(greetingKey(new Date().getHours()) as never)}
        </Text>
        <IconButton icon="library" size={40} onPress={() => nav.navigate('LibraryTab' as never)} accessibilityLabel={t('tab_library')} />
      </Animated.View>

      {current ? (
        <>
          {/* Карточка текущего документа (как в референсе) */}
          <Animated.View
            pointerEvents={immersive ? 'none' : 'auto'}
            style={{ opacity: chromeFade, marginHorizontal: 20, marginTop: 12 }}
          >
          <Pressable
            onPress={() => nav.navigate('Document', { docId: current.id })}
            style={({ pressed }) => ({
              marginHorizontal: 20,
              marginTop: 12,
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 18,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <DocumentTypeIcon type={current.type} size={44} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: colors.text, fontFamily: UI_FONT_SEMIBOLD, fontSize: 15 }}>
                {current.title}
              </Text>
              <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 12, marginTop: 2 }}>
                {t(`library_type_${current.type}` as never)} · {formatNumber(current.wordCount)}{' '}
                {wordsLabel(current.wordCount, lang)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </Pressable>
          </Animated.View>

          {/* Живой RSVP-ридер */}
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 12 }}>
            <ReaderView onImmersiveChange={applyImmersive} />
          </View>
        </>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={{ paddingHorizontal: 20 }}>
            <EmptyState
              icon="book-outline"
              title={t('home_empty_title')}
              text={t('home_empty_text')}
              actionLabel={t('home_add_text')}
              onAction={() => nav.navigate('Import')}
            />
            {todayWords > 0 || summary.avgWpm > 0 ? (
              <Card style={{ flexDirection: 'row', gap: 10, paddingVertical: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 12 }}>
                    {t('home_today_words')}
                  </Text>
                  <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 18 }}>
                    {formatNumber(todayWords)}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 12 }}>
                    {t('home_avg_wpm')}
                  </Text>
                  <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 18 }}>
                    {summary.avgWpm || '—'}
                  </Text>
                </View>
              </Card>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}
