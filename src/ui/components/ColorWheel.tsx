/**
 * ColorWheel — круглый выбор любого цвета.
 *
 * Web: canvas-диск (оттенок по углу, насыщенность по радиусу, белый центр —
 * как классическая палитра) + слайдер яркости. Клик/перетаскивание по диску
 * выбирает цвет.
 * Native: тот же результат через три градиентных слайдера (тон/насыщенность/
 * яркость) — на touch это удобнее диска и даёт любой цвет.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { useTheme, UI_FONT_MEDIUM } from '../theme/ThemeProvider';

export interface Hsv {
  h: number; // 0..360
  s: number; // 0..1
  v: number; // 0..1
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const c = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(5)}${f(3)}${f(1)}`.toUpperCase();
}

export function hexToHsv(hex: string): Hsv {
  const m = hex.replace('#', '');
  const r = parseInt(m.slice(0, 2), 16) / 255;
  const g = parseInt(m.slice(2, 4), 16) / 255;
  const b = parseInt(m.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

function HsvColorWheel({
  size,
  brightness,
  onPick,
}: {
  size: number;
  brightness: number;
  onPick: (hsv: Hsv) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragging = useRef(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  // отрисовка диска: конический градиент оттенков + белый центр
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const R = size / 2;
    ctx.clearRect(0, 0, size, size);
    if (typeof (ctx as { createConicGradient?: unknown }).createConicGradient === 'function') {
      const grad = (
        ctx as CanvasRenderingContext2D & {
          createConicGradient: (a: number, x: number, y: number) => CanvasGradient;
        }
      ).createConicGradient(0, R, R);
      for (let a = 0; a <= 360; a += 30) {
        grad.addColorStop(a / 360, hsvToHex({ h: a === 360 ? 360 : a, s: 1, v: 1 }));
      }
      ctx.fillStyle = grad;
    } else {
      for (let a = 0; a < 360; a += 1) {
        ctx.beginPath();
        ctx.moveTo(R, R);
        ctx.arc(R, R, R, ((a - 0.6) * Math.PI) / 180, ((a + 1.6) * Math.PI) / 180);
        ctx.closePath();
        ctx.fillStyle = hsvToHex({ h: a, s: 1, v: 1 });
        ctx.fill();
      }
    }
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.fill();
    // белый центр → насыщенный край
    const radial = ctx.createRadialGradient(R, R, 0, R, R, R);
    radial.addColorStop(0, 'rgba(255,255,255,1)');
    radial.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = radial;
    ctx.beginPath();
    ctx.arc(R, R, R, 0, Math.PI * 2);
    ctx.fill();
    // яркость: затемнение всего диска
    if (brightness < 1) {
      ctx.fillStyle = `rgba(0,0,0,${1 - brightness})`;
      ctx.beginPath();
      ctx.arc(R, R, R, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [size, brightness]);

  const pickFromEvent = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const dx = e.clientX - rect.left - size / 2;
    const dy = e.clientY - rect.top - size / 2;
    const dist = Math.min(size / 2, Math.hypot(dx, dy));
    let h = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (h < 0) h += 360;
    const s = size / 2 === 0 ? 0 : dist / (size / 2);
    setCursor({ x: size / 2 + Math.cos((h * Math.PI) / 180) * dist, y: size / 2 + Math.sin((h * Math.PI) / 180) * dist });
    onPick({ h, s, v: brightness });
  };

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{ borderRadius: size / 2, touchAction: 'none', cursor: 'crosshair', alignSelf: 'center' }}
      onPointerDown={(e) => {
        dragging.current = true;
        (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
        pickFromEvent(e);
      }}
      onPointerMove={(e) => {
        if (dragging.current) pickFromEvent(e);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    />
  );
}

/** Круглая палитра: диск (web) или HSV-слайдеры (native) + яркость. */
export function ColorWheel({
  initialColor,
  onChange,
  size = 250,
}: {
  initialColor: string;
  onChange: (hex: string) => void;
  size?: number;
}) {
  const { colors } = useTheme();
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(initialColor));
  const [brightness, setBrightness] = useState(() => hexToHsv(initialColor).v);
  const lastEmitted = useRef(initialColor);

  // brightness отдельно от диска: меняем V, сохраняя H/S
  useEffect(() => {
    const hex = hsvToHex({ ...hsv, v: brightness });
    if (hex !== lastEmitted.current) {
      lastEmitted.current = hex;
      onChange(hex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hsv, brightness]);

  const preview = hsvToHex({ ...hsv, v: brightness });

  if (Platform.OS === 'web') {
    return (
      <View style={{ alignItems: 'center', gap: 14 }}>
        <HsvColorWheel
          size={size}
          brightness={brightness}
          onPick={(h) => setHsv(h)}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch' }}>
          <Ionicons name="moon-outline" size={16} color={colors.textSecondary} />
          <Slider
            style={{ flex: 1, height: 32 }}
            minimumValue={0}
            maximumValue={100}
            step={1}
            value={Math.round(brightness * 100)}
            onValueChange={(v) => setBrightness(v / 100)}
            onSlidingComplete={() => hapticTick()}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.borderStrong}
            thumbTintColor={colors.accent}
          />
          <Ionicons name="sunny-outline" size={16} color={colors.textSecondary} />
        </View>
        <ColorPreview
          preview={preview}
          onCommitText={(hex) => {
            const hsv = hexToHsv(hex);
            setHsv(hsv);
            setBrightness(hsv.v);
          }}
        />
      </View>
    );
  }

  // native: три градиентных слайдера H / S / V
  const hueColors = [0, 60, 120, 180, 240, 300, 360].map((h) => hsvToHex({ h, s: 1, v: 1 })) as unknown as readonly [string, string, ...string[]];
  const satColors = [hsvToHex({ h: hsv.h, s: 0, v: brightness }), hsvToHex({ h: hsv.h, s: 1, v: brightness })] as readonly [string, string, ...string[]];
  const valColors = ['#000000', hsvToHex({ h: hsv.h, s: hsv.s, v: 1 })] as readonly [string, string, ...string[]];
  return (
    <View style={{ gap: 16, alignSelf: 'stretch' }}>
      <GradientSlider
        value={hsv.h}
        max={360}
        colors={hueColors}
        onChange={(h) => setHsv((p) => ({ ...p, h }))}
      />
      <GradientSlider
        value={hsv.s * 100}
        max={100}
        colors={satColors}
        onChange={(v) => setHsv((p) => ({ ...p, s: v / 100 }))}
      />
      <GradientSlider
        value={brightness * 100}
        max={100}
        colors={valColors}
        onChange={(v) => setBrightness(v / 100)}
      />
      <ColorPreview
        preview={preview}
        onCommitText={(hex) => {
          const hsv = hexToHsv(hex);
          setHsv(hsv);
          setBrightness(hsv.v);
        }}
      />
    </View>
  );
}

function hapticTick() {
  import('../../services/haptics/Haptics').then(({ haptic }) => haptic.selection()).catch(() => undefined);
}

/** Поле ручного ввода HEX (#RGB или #RRGGBB) + превью цвета. */
function ColorPreview({
  preview,
  onCommitText,
}: {
  preview: string;
  onCommitText: (hex: string) => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(preview);
  const focused = useRef(false);

  // цвет из диска/слайдеров → в поле (если пользователь не печатает)
  useEffect(() => {
    if (!focused.current) setDraft(preview);
  }, [preview]);

  const applyDraft = (text: string) => {
    setDraft(text);
    const norm = normalizeHex(text);
    if (norm) onCommitText(norm);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' }}>
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: preview,
          borderWidth: 2,
          borderColor: colors.borderStrong,
        }}
      />
      <TextInput
        value={draft}
        onChangeText={applyDraft}
        onFocus={() => {
          focused.current = true;
        }}
        onBlur={() => {
          focused.current = false;
          setDraft(preview);
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={7}
        placeholder="#000000"
        placeholderTextColor={colors.textTertiary}
        style={{
          color: colors.text,
          fontFamily: UI_FONT_MEDIUM,
          fontSize: 15,
          letterSpacing: 1,
          backgroundColor: colors.surfaceAlt,
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderWidth: 1,
          borderColor: colors.border,
          minWidth: 110,
          textAlign: 'center',
        }}
      />
    </View>
  );
}

/** #RGB / #RRGGBB → #RRGGBB; невалидное — null. */
function normalizeHex(text: string): string | null {
  let t = text.trim().replace(/^#/, '').replace(/[^0-9a-fA-F]/g, '');
  if (t.length === 3) t = t.split('').map((c) => c + c).join('');
  if (t.length !== 6) return null;
  return `#${t.toUpperCase()}`;
}

function GradientSlider({
  value,
  max,
  colors: trackColors,
  onChange,
}: {
  value: number;
  max: number;
  colors: readonly [string, string, ...string[]];
  onChange: (v: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 36, justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: 10, right: 10, height: 12, borderRadius: 6, overflow: 'hidden' }}>
        <LinearGradient colors={trackColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </View>
      <Slider
        style={{ width: '100%', height: 36 }}
        minimumValue={0}
        maximumValue={max}
        step={1}
        value={value}
        onValueChange={onChange}
        minimumTrackTintColor="transparent"
        maximumTrackTintColor="transparent"
        thumbTintColor="#FFFFFF"
      />
    </View>
  );
}

