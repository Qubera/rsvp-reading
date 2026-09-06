import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, useWindowDimensions } from 'react-native';
import { Pressable, StatusBar, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Button, Card, IconButton, Sheet, WpmSlider } from '../../ui/components';
import { useTheme, UI_FONT_BOLD, UI_FONT_MEDIUM, UI_FONT_SEMIBOLD } from '../../ui/theme/ThemeProvider';
import { useI18n } from '../../core/i18n/I18nProvider';
import { useReaderStore, type FinishedInfo } from '../../app/stores/readerStore';
import { useSettingsStore } from '../../app/stores/settingsStore';
import { useAppStore } from '../../app/stores/appStore';
import { formatDuration, formatNumber } from '../../core/utils/format';
import type { RootStackParamList } from '../../app/navigation/RootNavigator';
import { ReaderView } from './ReaderView';
import { ReaderSettingsSheet } from './ReaderSettingsSheet';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Reader'>;

export function ReaderScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const appReady = useAppStore((s) => s.ready);
  const settings = useSettingsStore((s) => s.settings);
  const open = useReaderStore((s) => s.open);
  const flush = useReaderStore((s) => s.flush);
  const restart = useReaderStore((s) => s.restart);
  const seekFraction = useReaderStore((s) => s.seekFraction);
  const index = useReaderStore((s) => s.index);
  const size = useReaderStore((s) => s.size);
  const headerOffset = useReaderStore((s) => s.offset);
  const docTitle = useReaderStore((s) => s.docTitle);
  const finishedInfo = useReaderStore((s) => s.finishedInfo);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const { width: winW, height: winH } = useWindowDimensions();
  const landscape = winW > winH;
  const [immersive, setImmersive] = useState(false);
  const headerFade = useRef(new Animated.Value(1)).current;
  const applyImmersive = (v: boolean) => {
    setImmersive(v);
    Animated.timing(headerFade, { toValue: v ? 0 : 1, duration: 200, useNativeDriver: true }).start();
  };
  const [gotoOpen, setGotoOpen] = useState(false);
  const [gotoValue, setGotoValue] = useState(0);

  useEffect(() => {
    if (!appReady) return;
    void open(params.docId, { from: params.from, to: params.to });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appReady, params.docId, params.from, params.to, params.ts, open]);

  useEffect(() => {
    void activateKeepAwakeAsync();
    return () => {
      deactivateKeepAwake();
      flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openGoto = () => {
    setGotoValue(index);
    setGotoOpen(true);
  };

  const bg = settings.backgroundColor;

  const finishStats = useMemo(() => finishedInfo, [finishedInfo]);

  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      <StatusBar barStyle={isLightBg(bg) ? 'dark-content' : 'light-content'} />

      {/* Шапка: в иммерсивном режиме скрывается, остаётся только текст */}
      <Animated.View
        pointerEvents={immersive ? 'none' : 'auto'}
        style={{
          opacity: headerFade,
          paddingTop: insets.top + 6,
          paddingHorizontal: 10,
          paddingBottom: 6,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}
      >
        <IconButton icon="chevron-back" size={40} background="transparent" tint={settings.textColor} onPress={() => nav.goBack()} accessibilityLabel={t('common_back')} />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text numberOfLines={1} style={{ color: settings.textColor, fontFamily: UI_FONT_SEMIBOLD, fontSize: 15, opacity: 0.85 }}>
            {docTitle}
          </Text>
          <Text style={{ color: settings.textColor, fontFamily: UI_FONT_MEDIUM, fontSize: 12, opacity: 0.5, fontVariant: ['tabular-nums'] }}>
            {formatNumber(headerOffset + index + 1)} / {formatNumber(headerOffset + size)}
          </Text>
        </View>
        <IconButton
          icon="book-outline"
          size={40}
          background="transparent"
          tint={settings.textColor}
          onPress={() => nav.navigate('FullText', { docId: params.docId })}
          accessibilityLabel={t('reader_full_text')}
        />
        <IconButton
          icon="ellipsis-horizontal"
          size={40}
          background="transparent"
          tint={settings.textColor}
          onPress={() => setSettingsOpen(true)}
          accessibilityLabel={t('reader_settings')}
        />
      </Animated.View>

      {/* Ридер: в альбомном — без боковых отступов и с панелью справа */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: landscape ? 4 : 20,
          paddingBottom: landscape ? insets.bottom : insets.bottom + 14,
        }}
      >
        <ReaderView fullscreen sideControls={landscape} onImmersiveChange={applyImmersive} />
      </View>

      {/* Диалог завершения */}
      {finishStats ? (
        <View
          style={{
            ...({ position: 'absolute' as const }),
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            backgroundColor: 'rgba(2, 5, 12, 0.72)',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 24,
          }}
        >
          <Card style={{ width: '100%', maxWidth: 420, paddingVertical: 26 }}>
            <View style={{ alignItems: 'center', gap: 6 }}>
              <View
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 999,
                  backgroundColor: colors.accentSoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="checkmark" size={36} color={colors.accent} />
              </View>
              <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 22, marginTop: 8 }}>
                {t('reader_finished_title')}
              </Text>
              <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 14, textAlign: 'center' }}>
                {t('reader_finished_text', { title: docTitle })}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
              <StatBox label={t('reader_session_words')} value={formatNumber(finishStats.wordsRead)} />
              <StatBox label={t('reader_session_time')} value={formatDuration(finishStats.ms, lang)} />
              <StatBox label={t('reader_session_wpm')} value={finishStats.wpm > 0 ? formatNumber(finishStats.wpm) : '—'} />
            </View>
            <View style={{ gap: 10, marginTop: 20 }}>
              <Button label={t('reader_restart_btn')} icon="refresh" variant="secondary" onPress={restart} />
              <Button label={t('reader_close_btn')} onPress={() => nav.goBack()} />
            </View>
          </Card>
        </View>
      ) : null}

      {/* Настройки чтения */}
      <ReaderSettingsSheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Перейти к месту */}
      <Sheet visible={gotoOpen} onClose={() => setGotoOpen(false)} title={t('reader_seek')}>
        <View style={{ gap: 12 }}>
          <WpmSlider
            label={t('reader_seek')}
            value={Math.max(1, Math.round(((gotoValue + 1) / Math.max(1, size)) * 100))}
            min={1}
            max={100}
            onChange={(v) => setGotoValue(Math.round((v / 100) * (size - 1)))}
            unit="%"
          />
          <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 13, textAlign: 'center' }}>
            {formatNumber(gotoValue + 1)} / {formatNumber(size)}
          </Text>
          <Button
            label={t('common_ok')}
            icon="checkmark"
            onPress={() => {
              seekFraction(gotoValue / Math.max(1, size - 1));
              setGotoOpen(false);
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 12 }}>
      <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 11 }}>{label}</Text>
      <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 15, marginTop: 3, fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
    </View>
  );
}

function isLightBg(hex: string): boolean {
  const m = hex.replace('#', '');
  if (m.length < 6) return false;
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6;
}
