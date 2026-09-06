import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Chip, SectionTitle, Segmented, WpmSlider } from '../../ui/components';
import { useTheme, UI_FONT_BOLD, UI_FONT_MEDIUM, UI_FONT_SEMIBOLD } from '../../ui/theme/ThemeProvider';
import { useI18n } from '../../core/i18n/I18nProvider';
import { useLibraryStore } from '../../app/stores/libraryStore';
import { useSettingsStore } from '../../app/stores/settingsStore';
import { formatDuration, formatNumber, wordsLabel } from '../../core/utils/format';
import { clampWpm } from '../../core/models/UserSettings';
import type { RootStackParamList } from '../../app/navigation/RootNavigator';
import { DocumentTypeIcon } from './DocIcon';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, 'Document'>;

type RangeMode = 'full' | 'pages' | 'fragment';

export function DocumentScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const nav = useNavigation<Nav>();
  const { params } = useRoute<Route>();
  const insets = useSafeAreaInsets();
  const meta = useLibraryStore((s) => s.docs.find((d) => d.id === params.docId));
  const settings = useSettingsStore((s) => s.settings);
  const updateSettings = useSettingsStore((s) => s.update);

  const pageCount = meta?.pages?.length ?? 1;
  const [mode, setMode] = useState<RangeMode>('full');
  const [fromPage, setFromPage] = useState(1);
  const [toPage, setToPage] = useState(Math.min(pageCount, 10));
  const [fragStart, setFragStart] = useState(0); // 0..100 %
  const [fragLen, setFragLen] = useState(20); // 5..100 %

  const pages = meta?.pages ?? null;

  const range = useMemo(() => {
    if (!meta) return null;
    if (mode === 'full') return { from: 0, to: meta.wordCount };
    if (mode === 'pages' && pages) {
      const a = Math.max(1, Math.min(fromPage, toPage, pageCount));
      const b = Math.max(a, Math.min(toPage, pageCount));
      return { from: pages[a - 1], to: b < pageCount ? pages[b] : meta.wordCount };
    }
    // fragment
    const from = Math.round((fragStart / 100) * Math.max(0, meta.wordCount - 1));
    const len = Math.max(10, Math.round((fragLen / 100) * meta.wordCount));
    return { from, to: Math.min(meta.wordCount, from + len) };
  }, [meta, mode, pages, fromPage, toPage, pageCount, fragStart, fragLen]);

  if (!meta) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.textSecondary }}>{t('common_loading')}</Text>
      </View>
    );
  }

  const rangeWords = range ? range.to - range.from : meta.wordCount;
  const estMs = range ? (rangeWords / Math.max(100, settings.wpm)) * 60000 : 0;
  const statusKey = `library_status_${meta.status}` as const;
  const continuePercent = Math.round(meta.progress * 100);

  const start = () => {
    if (!range) return;
    nav.navigate('Reader', { docId: meta.id, from: range.from, to: range.to, ts: Date.now() });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Шапка */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={{ width: 38, height: 38, justifyContent: 'center' }}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontFamily: UI_FONT_SEMIBOLD, fontSize: 17 }}>
          {meta.title}
        </Text>
        <Chip label={t(statusKey as never)} active={meta.status === 'reading'} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}>
        {/* Инфо */}
        <Card style={{ marginBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <DocumentTypeIcon type={meta.type} size={56} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 18 }}>
                {meta.title}
              </Text>
              <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 13, marginTop: 3 }}>
                {t(`library_type_${meta.type}` as never)} · {formatNumber(meta.wordCount)} {wordsLabel(meta.wordCount, lang)}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 12 }}>
              <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 11 }}>
                {t('doc_est_time', { time: formatDuration(estMs, lang) })}
              </Text>
              <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 15, marginTop: 3 }}>
                ≈ {formatNumber(rangeWords)} {t('doc_words')}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 14, padding: 12 }}>
              <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 11 }}>
                {t('doc_progress')}
              </Text>
              <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 15, marginTop: 3 }}>
                {continuePercent}% · {t('doc_pages_total', { n: pageCount })}
              </Text>
            </View>
          </View>
        </Card>

        {/* Диапазон чтения */}
        <SectionTitle>{t('doc_range_title')}</SectionTitle>
        <Card style={{ marginBottom: 18 }}>
          <Segmented<RangeMode>
            value={mode}
            onChange={setMode}
            options={[
              { key: 'full', label: t('doc_range_full') },
              { key: 'pages', label: t('doc_range_pages') },
              { key: 'fragment', label: t('doc_range_fragment') },
            ]}
          />

          {mode === 'pages' ? (
            <View style={{ marginTop: 16, gap: 12 }}>
              <StepperRow
                label={t('doc_range_from')}
                value={fromPage}
                min={1}
                max={pageCount}
                onChange={setFromPage}
                suffix={`/ ${pageCount}`}
              />
              <StepperRow
                label={t('doc_range_to')}
                value={toPage}
                min={1}
                max={pageCount}
                onChange={setToPage}
                suffix={`/ ${pageCount}`}
              />
            </View>
          ) : null}

          {mode === 'fragment' ? (
            <View style={{ marginTop: 16 }}>
              <WpmSlider
                label={t('doc_fragment_start')}
                value={fragStart}
                min={0}
                max={100}
                onChange={(v) => setFragStart(Math.max(0, Math.min(fragStart, 95)))}
                onCommit={(v) => setFragStart(v)}
                unit="%"
              />
              <View style={{ height: 12 }} />
              <WpmSlider
                label={t('doc_fragment_len')}
                value={fragLen}
                min={5}
                max={100}
                onChange={(v) => setFragLen(v)}
                onCommit={(v) => setFragLen(v)}
                unit="%"
              />
              <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 12, marginTop: 8 }}>
                {t('doc_fragment_words', { n: formatNumber(rangeWords) })}
              </Text>
            </View>
          ) : null}
        </Card>

        {/* Быстрые настройки чтения */}
        <SectionTitle>{t('doc_reading_settings')}</SectionTitle>
        <Card style={{ marginBottom: 8 }}>
          <WpmSlider
            label={t('settings_wpm')}
            value={settings.wpm}
            min={100}
            max={1500}
            onChange={(v) => updateSettings({ wpm: clampWpm(v) })}
            unit={t('stats_wpm_unit')}
          />
        </Card>
      </ScrollView>

      {/* Кнопка запуска */}
      <View
        style={{
          position: 'absolute',
          left: 20,
          right: 20,
          bottom: insets.bottom + 16,
          gap: 10,
        }}
      >
        {meta.status !== 'new' ? (
          <Button
            label={t('doc_restart')}
            icon="refresh"
            variant="secondary"
            onPress={() => nav.navigate('Reader', { docId: meta.id, from: 0, to: meta.wordCount, ts: Date.now() })}
          />
        ) : null}
        <Button
          label={meta.status === 'new' ? t('doc_start') : t('doc_continue', { percent: continuePercent })}
          icon="play"
          onPress={start}
        />
      </View>
    </View>
  );
}

function StepperRow({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  const { colors } = useTheme();
  const btn = (icon: 'remove' | 'add', delta: number) => (
    <Pressable
      onPress={() => onChange(Math.max(min, Math.min(max, value + delta)))}
      hitSlop={6}
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 14 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {btn('remove', -1)}
        <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 16, minWidth: 30, textAlign: 'center' }}>
          {value}
        </Text>
        {btn('add', 1)}
        {suffix ? <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 13 }}>{suffix}</Text> : null}
      </View>
    </View>
  );
}
