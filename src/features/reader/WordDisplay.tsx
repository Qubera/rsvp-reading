/**
 * WordDisplay: одно слово RSVP с контекстом строки.
 *
 * ORP-режим: экран делится ровно пополам — префикс прижат вправо,
 * опорная буква + хвост идут от центра. Опорная буква всегда в одной и той же
 * точке экрана, поэтому взгляд не двигается.
 * Слева от слова — предыдущие слова строки, справа — следующие (мелко,
 * приглушённо): чтение выглядит как осмысленный текст, а не случайные слова.
 * Контекст не влияет на позицию пивота: он «висит» снаружи и обрезается
 * по краям, центр остаётся зафиксирован.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { splitAtOrp } from '../../core/reader/orp';
import { useTheme } from '../../ui/theme/ThemeProvider';

export function WordDisplay({
  word,
  prevWords = [],
  nextWords = [],
  fontSize,
  fontFamily,
  orpEnabled,
  textColor,
  pivotColor,
}: {
  word: string;
  prevWords?: string[];
  nextWords?: string[];
  fontSize: number;
  fontFamily: string;
  orpEnabled: boolean;
  textColor: string;
  pivotColor?: string;
}) {
  const { colors } = useTheme();
  const pivot = pivotColor ?? colors.accent;

  // длинные слова сжимаем
  const scale = useMemo(() => {
    const max = 13;
    if (word.length <= max) return 1;
    return Math.max(0.52, max / word.length);
  }, [word]);

  const size = Math.round(fontSize * scale);
  const ctxSize = size; // контекст того же размера, отличен только прозрачностью
  const lh = Math.round(fontSize * 1.55);
  // холст для контекста: достаточно широк, чтобы текст не переносился,
  // а «уезжал» за край экрана, не сжимая центральное слово
  const CANVAS_W = 2000;
  const prevText = prevWords.length > 0 ? prevWords.join(' ') + ' ' : '';
  const nextText = nextWords.length > 0 ? ' ' + nextWords.join(' ') : '';

  if (!orpEnabled) {
    return (
      <View style={styles.centerRow}>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.5}
          numberOfLines={1}
          style={{ color: textColor, fontFamily, fontSize: size, fontWeight: '700' }}
        >
          <Text style={{ opacity: 0.18, fontSize: ctxSize }}>{prevText}</Text>
          {word}
          <Text style={{ opacity: 0.18, fontSize: ctxSize }}>{nextText}</Text>
        </Text>
      </View>
    );
  }

  const { prefix, pivot: p, suffix } = splitAtOrp(word);

  return (
    <View style={[styles.orpRow, { height: lh }]}>
      {/* ЛЕВАЯ половина: пивот-фиксация. prefix прижат к разделу, контекст
          уходит влево за пределы экрана, НЕ сжимая центральное слово. */}
      <View style={[styles.left, { position: 'relative', overflow: 'visible', height: lh }]}>
        <View style={{ height: lh }} />
        <Text
          style={{
            position: 'absolute',
            right: 0,
            top: 0,
            width: CANVAS_W,
            textAlign: 'right',
            fontFamily,
            fontSize: size,
            lineHeight: lh,
          }}
        >
          <Text style={{ color: textColor, opacity: 0.18, fontSize: ctxSize }}>{prevText}</Text>
          <Text style={{ color: textColor, fontWeight: '700' }}>{prefix}</Text>
        </Text>
      </View>
      {/* ПРАВАЯ половина: pivot + suffix от раздела, следующий контекст уезжает вправо. */}
      <View style={[styles.right, { position: 'relative', overflow: 'visible', height: lh }]}>
        <View style={{ height: lh }} />
        <Text
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: CANVAS_W,
            textAlign: 'left',
            fontFamily,
            fontSize: size,
            lineHeight: lh,
          }}
        >
          <Text style={{ color: textColor, fontWeight: '700' }}>
            <Text style={{ color: pivot }}>{p}</Text>
            {suffix}
          </Text>
          <Text style={{ color: textColor, opacity: 0.18, fontSize: ctxSize }}>{nextText}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centerRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  orpRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  left: { flex: 1, alignItems: 'flex-end', paddingRight: 1, paddingLeft: 16 },
  right: { flex: 1, alignItems: 'flex-start', paddingLeft: 1, paddingRight: 16 },
});
