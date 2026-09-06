import React, { useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, UI_FONT_BOLD, UI_FONT_SEMIBOLD, UI_FONT_MEDIUM } from '../../ui/theme/ThemeProvider';
import { useI18n } from '../../core/i18n/I18nProvider';
import { useSettingsStore } from '../../app/stores/settingsStore';
import { haptic } from '../../services/haptics/Haptics';

type Slide = { icon: keyof typeof Ionicons.glyphMap; title: string; text: string };

const SLIDES = [
  { icon: 'eye-outline', title: 'onboarding_slide1_title', text: 'onboarding_slide1_text' },
  { icon: 'flash-outline', title: 'onboarding_slide2_title', text: 'onboarding_slide2_text' },
  { icon: 'speedometer-outline', title: 'onboarding_slide3_title', text: 'onboarding_slide3_text' },
  { icon: 'download-outline', title: 'onboarding_slide4_title', text: 'onboarding_slide4_text' },
] as const;

export function OnboardingScreen({ onDone }: { onDone?: () => void }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList<Slide>>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const update = useSettingsStore((s) => s.update);

  const slides = useMemo(
    () => SLIDES.map((s) => ({ ...s, title: t(s.title), text: t(s.text) })),
    [t],
  );

  const go = (i: number) => {
    const clamped = Math.max(0, Math.min(i, slides.length - 1));
    setPage(clamped);
    haptic.selection();
    listRef.current?.scrollToOffset({ offset: clamped * width, animated: true });
    Animated.spring(progress, {
      toValue: clamped / (slides.length - 1),
      useNativeDriver: false,
      speed: 20,
    }).start();
  };

  const finish = () => {
    haptic.success();
    update({ onboarded: true });
    onDone?.();
  };

  const last = page === slides.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg, paddingTop: insets.top + 24 }]}>
      {/* Логотип */}
      <View style={styles.logoRow}>
        <View style={[styles.logoBadge, { backgroundColor: colors.accent }]}>
          <Ionicons name="eye" size={22} color={colors.onAccent} />
        </View>
        <Text style={[styles.logoText, { color: colors.text }]}>RSVP Reading</Text>
        <View style={{ flex: 1 }} />
        {!last ? (
          <Pressable onPress={finish} hitSlop={8}>
            <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 15 }}>
              {t('common_skip')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={slides}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={{ width, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center' }}>
            <View
              style={{
                width: 132,
                height: 132,
                borderRadius: 40,
                backgroundColor: colors.accentSoft,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 36,
              }}
            >
              <Ionicons name={item.icon} size={58} color={colors.accent} />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
            <Text style={[styles.text, { color: colors.textSecondary }]}>{item.text}</Text>
          </View>
        )}
      />

      {/* Точки */}
      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === page ? 26 : 8,
              height: 8,
              borderRadius: 999,
              backgroundColor: i === page ? colors.accent : colors.borderStrong,
            }}
          />
        ))}
      </View>

      <View style={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 20 }}>
        <Pressable
          onPress={() => (last ? finish() : go(page + 1))}
          style={({ pressed }) => ({
            backgroundColor: colors.accent,
            borderRadius: 18,
            height: 58,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: colors.onAccent, fontFamily: UI_FONT_BOLD, fontSize: 17 }}>
            {page === 0 ? t('common_start') : last ? t('common_done') : t('common_next')}
          </Text>
          {!last ? <Ionicons name="arrow-forward" size={18} color={colors.onAccent} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 24 },
  logoBadge: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontFamily: UI_FONT_BOLD, fontSize: 17 },
  title: { fontFamily: UI_FONT_BOLD, fontSize: 26, textAlign: 'center', marginBottom: 14 },
  text: { fontFamily: UI_FONT_MEDIUM, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginBottom: 24 },
});
