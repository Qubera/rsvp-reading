import React, { useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../ui/components/Screen';
import { Card, Chip, EmptyState, SectionTitle } from '../../ui/components';
import { useTheme, UI_FONT_BOLD, UI_FONT_MEDIUM, UI_FONT_SEMIBOLD } from '../../ui/theme/ThemeProvider';
import { useI18n } from '../../core/i18n/I18nProvider';
import { useStatsStore } from '../../app/stores/statsStore';
import { aggregateSessions, type StatsRange } from '../../domain/stats/aggregate';
import { formatDateShort, formatDuration, formatNumber, weekdayLabels } from '../../core/utils/format';

export function StatsScreen() {
  const { colors } = useTheme();
  const { t, lang } = useI18n();
  const sessions = useStatsStore((s) => s.sessions);
  const [range, setRange] = useState<StatsRange>('week');

  const summary = useMemo(() => aggregateSessions(sessions, range), [sessions, range]);
  const empty = summary.sessions === 0 && summary.totalWords === 0;

  const maxWords = Math.max(1, ...summary.buckets.map((b) => b.words));
  const wd = weekdayLabels(lang);

  const barLabels = useMemo(
    () =>
      summary.buckets.map((b) => {
        if (range === 'week') return wd[new Date(b.startTs).getDay() === 0 ? 6 : new Date(b.startTs).getDay() - 1];
        return formatDateShort(b.startTs, lang);
      }),
    [summary.buckets, range, lang, wd],
  );

  return (
    <Screen>
      <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 28, marginBottom: 16 }}>
        {t('stats_title')}
      </Text>

      {/* Фильтры */}
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 18 }}>
        {(['week', 'month', 'all'] as StatsRange[]).map((r) => (
          <Chip
            key={r}
            label={t(`stats_filter_${r}` as never)}
            active={range === r}
            onPress={() => setRange(r)}
          />
        ))}
      </View>

      {empty ? (
        <Card>
          <EmptyState icon="stats-chart-outline" title={t('stats_empty_title')} text={t('stats_empty_text')} />
        </Card>
      ) : (
        <>
          {/* Метрики */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
            <Card style={{ flex: 1, paddingVertical: 16 }}>
              <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 12 }}>
                {t('stats_total_words')}
              </Text>
              <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 24, marginTop: 4, fontVariant: ['tabular-nums'] }}>
                {formatNumber(summary.totalWords)}
              </Text>
              <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 11 }}>
                {t('stats_words_unit')}
              </Text>
            </Card>
            <Card style={{ flex: 1, paddingVertical: 16 }}>
              <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 12 }}>
                {t('stats_avg_wpm')}
              </Text>
              <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 24, marginTop: 4, fontVariant: ['tabular-nums'] }}>
                {formatNumber(summary.avgWpm)}
              </Text>
              <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 11 }}>
                {t('stats_wpm_unit')}
              </Text>
            </Card>
          </View>

          {/* График */}
          <Card style={{ marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: colors.text, fontFamily: UI_FONT_SEMIBOLD, fontSize: 15 }}>
                {t('stats_reading_time')}: {formatDuration(summary.totalMs, lang)}
              </Text>
              <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 13 }}>
                {t('stats_sessions')}: {summary.sessions}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', height: 150 }}>
              {/* Ось Y */}
              <View style={{ width: 38, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6, paddingVertical: 4 }}>
                {[5, 4, 3, 2, 1, 0].map((i) => (
                  <Text key={i} style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 9, fontVariant: ['tabular-nums'] }}>
                    {formatNumber(Math.round((maxWords / 5) * i))}
                  </Text>
                ))}
              </View>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
                {summary.buckets.map((b, i) => {
                  const h = b.words === 0 ? 3 : Math.max(4, Math.round((b.words / maxWords) * 130));
                  const todayIdx = range === 'week' ? (new Date().getDay() + 6) % 7 : -1;
                  const isToday = i === todayIdx && b.words > 0;
                  return (
                    <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                      <View
                        style={{
                          width: '100%',
                          maxWidth: 34,
                          height: h,
                          borderRadius: 6,
                          backgroundColor: b.words === 0 ? colors.surfaceAlt : isToday ? colors.accent : colors.chartBarDim,
                        }}
                      />
                      <Text numberOfLines={1} style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 9 }}>
                        {barLabels[i]}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </Card>

          {/* Лучшие результаты */}
          <SectionTitle>{t('stats_best_title')}</SectionTitle>
          <Card style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <BestIcon icon="speedometer-outline" />
              <Text style={{ flex: 1, color: colors.text, fontFamily: UI_FONT_MEDIUM, fontSize: 14 }}>
                {t('stats_max_wpm')}
              </Text>
              <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 15, fontVariant: ['tabular-nums'] }}>
                {formatNumber(summary.bestWpm)} {t('stats_wpm_unit')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <BestIcon icon="trophy-outline" />
              <Text style={{ flex: 1, color: colors.text, fontFamily: UI_FONT_MEDIUM, fontSize: 14 }}>
                {t('stats_best_day')}
              </Text>
              <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 15, fontVariant: ['tabular-nums'] }}>
                {t('stats_best_day_value', { n: formatNumber(summary.bestDayWords) })}
              </Text>
            </View>
          </Card>
        </>
      )}
    </Screen>
  );
}

function BestIcon({ icon }: { icon: keyof typeof Ionicons.glyphMap }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: 11,
        backgroundColor: colors.accentSoft,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={16} color={colors.accent} />
    </View>
  );
}
