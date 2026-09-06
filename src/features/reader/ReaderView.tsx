/**
 * ReaderView: слово по центру + прогресс + контролы + слайдер скорости.
 * Используется и на главном табе «Чтение», и в полноэкранном ReaderScreen.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useTheme, UI_FONT_BOLD, UI_FONT_MEDIUM, UI_FONT_SEMIBOLD, READER_FONTS } from '../../ui/theme/ThemeProvider';
import { useI18n } from '../../core/i18n/I18nProvider';
import { useReaderStore } from '../../app/stores/readerStore';
import { useSettingsStore } from '../../app/stores/settingsStore';
import { WPM_MAX, WPM_MIN, clampWpm, FONT_SIZE_MAX } from '../../core/models/UserSettings';
import { formatNumber } from '../../core/utils/format';
import { haptic } from '../../services/haptics/Haptics';
import { WordDisplay } from './WordDisplay';
import { IconButton } from '../../ui/components';

export function ReaderView({
  fullscreen = false,
  sideControls = false,
  onImmersiveChange,
}: {
  fullscreen?: boolean;
  /** альбомный режим: панель управления сбоку, слово на всю высоту */
  sideControls?: boolean;
  /** true — интерфейс скрыт, остался только текст (иммерсивный режим) */
  onImmersiveChange?: (immersive: boolean) => void;
} = {}) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);
  const index = useReaderStore((s) => s.index);
  const size = useReaderStore((s) => s.size);
  const offset = useReaderStore((s) => s.offset);
  const wordCount = useReaderStore((s) => s.wordCount);
  const engineState = useReaderStore((s) => s.engineState);
  const engine = useReaderStore((s) => s.engine);
  const toggle = useReaderStore((s) => s.toggle);
  const nextSentence = useReaderStore((s) => s.nextSentence);
  const prevSentence = useReaderStore((s) => s.prevSentence);
  const seekIndex = useReaderStore((s) => s.seekIndex);
  const setWpmLive = useReaderStore((s) => s.setWpmLive);
  const restart = useReaderStore((s) => s.restart);

  const [controlsVisible, setControlsVisible] = useState(true);
  const { width: winW, height: winH } = useWindowDimensions();
  const isLandscape = winW > winH;
  const fade = useRef(new Animated.Value(1)).current;
  const [wpmDraft, setWpmDraft] = useState<number | null>(null);
  const finished = engineState === 'finished';
  const playing = engineState === 'playing';
  const [wordAreaH, setWordAreaH] = useState(600);
  // шрифт не выше 60% высоты области слова — не обрезается ни в портрете, ни в альбоме
  const effFontSize = Math.min(settings.fontSize, Math.floor(wordAreaH * 0.6));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controlsVisibleRef = useRef(true);
  // «барабан»: слово следует за пальцем при свайпе и плавно сменяется
  const dragX = useRef(new Animated.Value(0)).current;
  const slideX = useRef(new Animated.Value(0)).current;
  const slideO = useRef(new Animated.Value(1)).current;
  const lastIndex = useRef(index);
  const fromDrag = useRef(false);

  const word = engine && size > 0 ? engine.wordAt(index) : '';
  // контекст строки: одно слово слева и одно справа
  const prevWords = engine ? [engine.wordAt(index - 1)].filter(Boolean) : [];
  const nextWords = engine ? [engine.wordAt(index + 1)].filter(Boolean) : [];

  const fontFamily = READER_FONTS[settings.font].regular;
  const currentGlobal = offset + index;
  const percent = size > 0 ? Math.round(((index + 1) / size) * 100) : 0;

  const setControls = (v: boolean) => {
    controlsVisibleRef.current = v;
    setControlsVisible(v);
    Animated.timing(fade, { toValue: v ? 1 : 0, duration: 200, useNativeDriver: true }).start();
    onImmersiveChange?.(!v);
  };

  // автоскрытие панели через 10 секунд чтения; на паузе панель возвращается
  const scheduleHide = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 10000);
  };
  const bumpControls = () => {
    if (!controlsVisible) setControls(true);
    scheduleHide();
  };

  useEffect(() => {
    if (playing) scheduleHide();
    else if (!isLandscape) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (!controlsVisible) setControls(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, isLandscape]);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  // Смена слова: анимация «въезда» — только при свайпе (по запросу);
  // при обычном воспроизведении — мгновенная замена, чтобы не размывать текст
  useEffect(() => {
    if (fromDrag.current) {
      fromDrag.current = false;
      const dir = index >= lastIndex.current ? 1 : -1;
      slideX.setValue(dir * 26);
      slideO.setValue(0.25);
      Animated.parallel([
        Animated.timing(slideX, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(slideO, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    } else {
      slideX.setValue(0);
      slideO.setValue(1);
    }
    lastIndex.current = index;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  // Жесты по области слова: горизонталь — перемотка (≈14px = 1 слово),
  // вертикаль — плавное изменение размера шрифта (вниз — меньше, вверх — больше).
  const gesture = useRef({ axis: null as null | 'x' | 'y', startX: 0, startY: 0, startFont: settings.fontSize, startIndex: 0, lastSeek: 0 });
  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponderCapture: (_e, g) =>
          Math.abs(g.dx) > 18 || Math.abs(g.dy) > 18,
        onPanResponderGrant: (_e, g) => {
          gesture.current = {
            axis: null,
            startX: g.x0,
            startY: g.y0,
            startFont: useSettingsStore.getState().settings.fontSize,
            startIndex: index,
            lastSeek: index,
          };
        },
        onPanResponderMove: (_e, g) => {
          const st = gesture.current;
          if (st.axis === null) {
            if (Math.abs(g.dx) > 18 || Math.abs(g.dy) > 18) {
              st.axis = Math.abs(g.dx) >= Math.abs(g.dy) ? 'x' : 'y';
              st.startX = g.moveX;
              st.startY = g.moveY;
            }
            return;
          }
          if (st.axis === 'x') {
            // «барабан»: каждые ~14px — одно слово; между шагами слово
            // тянется за пальцем, при шаге — плавный въезд нового
            const total = g.moveX - st.startX;
            const target = Math.max(0, Math.min(size - 1, st.startIndex + Math.round(-total / 14)));
            const residual = -(total - (target - st.startIndex) * 14) * 0.8;
            dragX.setValue(Math.max(-30, Math.min(30, residual)));
            if (target !== st.lastSeek) {
              st.lastSeek = target;
              fromDrag.current = true;
              haptic.light();
              seekIndex(target);
            }
          } else if (st.axis === 'y') {
            // тянем вниз — шрифт меньше; вверх — больше (6px = 1px шрифта)
            const next = Math.round(
              Math.max(16, Math.min(FONT_SIZE_MAX, st.startFont - (g.moveY - st.startY) / 6)),
            );
            if (next !== useSettingsStore.getState().settings.fontSize) {
              useSettingsStore.getState().update({ fontSize: next });
            }
          }
        },
        onPanResponderRelease: (_e, g) => {
          const st = gesture.current;
          if (st.axis === 'x') {
            Animated.spring(dragX, { toValue: 0, speed: 26, useNativeDriver: true }).start();
          } else if (st.axis === 'y') {
            haptic.selection();
          } else if (Math.abs(g.dx) < 10 && Math.abs(g.dy) < 10) {
            // тап — показать/скрыть панель
            haptic.light();
            if (controlsVisibleRef.current) {
              setControls(false);
              if (hideTimer.current) clearTimeout(hideTimer.current);
            } else {
              setControls(true);
              if (playing) scheduleHide();
            }
          }
          st.axis = null;
        },
      }),
    [index, size, seekIndex],
  );

  if (!engine || size === 0) return null;

  return (
    <View style={{ flex: 1, flexDirection: sideControls ? 'row' : 'column' }}>
      {/* Слово: жесты (свайп-перемотка / свайп-размер) живут на родителе,
          чтобы перехватывать движение до Pressable */}
      <View
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        onLayout={(e) => setWordAreaH(e.nativeEvent.layout.height)}
        {...pan.panHandlers}
        accessibilityLabel={`${currentGlobal + 1}`}
      >
        {finished && !fullscreen ? (
          <View style={{ alignItems: 'center', gap: 12 }}>
            <Ionicons name="checkmark-circle" size={44} color={colors.success} />
            <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 18 }}>
              {t('reader_done')}
            </Text>
          </View>
        ) : (
          <Animated.View
            style={{
              transform: [{ translateX: Animated.add(dragX, slideX) }],
              opacity: slideO,
            }}
          >
          <WordDisplay
            word={word}
            prevWords={prevWords}
            nextWords={nextWords}
            fontSize={effFontSize}
            fontFamily={fontFamily}
            orpEnabled={settings.orpEnabled}
            textColor={settings.textColor}
            pivotColor={settings.pivotColor}
          />
          </Animated.View>
        )}
      </View>

      {/* Прогресс */}
      <View style={{ alignItems: 'center', paddingBottom: 8 }}>
        <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_SEMIBOLD, fontSize: 15, fontVariant: ['tabular-nums'] }}>
          {formatNumber(currentGlobal + 1)} / {formatNumber(wordCount)}
        </Text>
        <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 12, marginTop: 2 }}>
          {percent}%
        </Text>
      </View>

      {/* Контролы: скрываются тапом мимо и сами через 10 секунд чтения */}
      <Animated.View
        style={[
          sideControls
            ? { width: 320, alignSelf: 'stretch', justifyContent: 'center', paddingHorizontal: 8 }
            : null,
          { opacity: fade, pointerEvents: controlsVisible ? 'auto' : 'none' },
        ]}
      >
          <View
            onTouchStart={() => bumpControls()}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: 1,
              borderRadius: 24,
              paddingHorizontal: 14,
              paddingTop: 10,
              paddingBottom: 12,
              gap: 6,
            }}
          >
            {/* Кнопки */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              <IconButton icon="play-back" size={46} onPress={() => seekIndex(Math.max(0, index - 25))} accessibilityLabel="-25" />
              <IconButton
                icon="chevron-back"
                size={46}
                onPress={() => seekIndex(Math.max(0, index - 1))}
                accessibilityLabel="prev word"
              />
              <Pressable
                onPress={() => {
                  haptic.medium();
                  if (finished) restart();
                  else toggle();
                }}
                accessibilityRole="button"
                accessibilityLabel={playing ? t('reader_pause') : t('reader_play')}
                style={({ pressed }) => ({
                  width: 68,
                  height: 68,
                  borderRadius: 999,
                  backgroundColor: colors.accent,
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Ionicons
                  name={playing ? 'pause' : finished ? 'refresh' : 'play'}
                  size={30}
                  color={colors.onAccent}
                />
              </Pressable>
              <IconButton
                icon="chevron-forward"
                size={46}
                onPress={() => seekIndex(Math.min(size - 1, index + 1))}
                accessibilityLabel="next word"
              />
              <IconButton icon="play-forward" size={46} onPress={() => seekIndex(Math.min(size - 1, index + 25))} accessibilityLabel="+25" />
            </View>

            {/* Скорость */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginBottom: -4 }}>
              <Ionicons name="speedometer-outline" size={16} color={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 13, flex: 1 }}>
                {t('reader_speed_short')}
              </Text>
              <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 14, fontVariant: ['tabular-nums'] }}>
                {t('reader_wpm', { n: wpmDraft ?? settings.wpm })}
              </Text>
            </View>
            <Slider
              minimumValue={WPM_MIN}
              maximumValue={WPM_MAX}
              step={10}
              value={settings.wpm}
              onValueChange={(v) => {
                const w = Math.round(v);
                setWpmDraft(w);
                setWpmLive(w); // мгновенная смена скорости
              }}
              onSlidingComplete={() => {
                setWpmDraft(null);
                haptic.selection();
              }}
              minimumTrackTintColor={colors.accent}
              maximumTrackTintColor={colors.borderStrong}
              thumbTintColor={colors.accent}
              style={{ width: '100%', height: 36 }}
            />
          </View>
      </Animated.View>
    </View>
  );
}
