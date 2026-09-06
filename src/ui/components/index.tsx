/** UI-кит приложения: всё в стиле референса — тёмный premium, крупный радиус. */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, UI_FONT_MEDIUM, UI_FONT_SEMIBOLD, UI_FONT_BOLD } from '../theme/ThemeProvider';
export { ColorWheel } from './ColorWheel';
import { haptic } from '../../services/haptics/Haptics';

// ------------------------------- Button -------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, radius } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const bg =
    variant === 'primary'
      ? colors.accent
      : variant === 'secondary'
        ? colors.surfaceAlt
        : variant === 'danger'
          ? colors.dangerSoft
          : 'transparent';
  const fg =
    variant === 'primary'
      ? colors.onAccent
      : variant === 'danger'
        ? colors.danger
        : colors.text;

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 40 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  };

  return (
    <Pressable
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={() => {
        if (disabled || loading) return;
        haptic.light();
        onPress?.();
      }}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Animated.View
        style={[
          {
            backgroundColor: bg,
            borderRadius: radius.button,
            height: 54,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            opacity: disabled ? 0.45 : 1,
            paddingHorizontal: 20,
          },
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={fg} />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
            <Text style={{ color: fg, fontFamily: UI_FONT_SEMIBOLD, fontSize: 16 }}>{label}</Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

// ------------------------------- IconButton -------------------------------

export function IconButton({
  icon,
  onPress,
  size = 44,
  background,
  tint,
  accessibilityLabel,
  stopPropagation,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: (e?: unknown) => void;
  size?: number;
  background?: string;
  tint?: string;
  accessibilityLabel?: string;
  /** не пропускать нажатие на родительский Pressable (кнопки внутри карточек) */
  stopPropagation?: boolean;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={(e) => {
        haptic.light();
        if (stopPropagation) (e as { stopPropagation?: () => void })?.stopPropagation?.();
        onPress?.(e);
      }}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? icon}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: radius.icon,
        backgroundColor: background ?? colors.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={Math.round(size * 0.5)} color={tint ?? colors.text} />
    </Pressable>
  );
}

// ------------------------------- Card -------------------------------

export function Card({
  children,
  style,
  onPress,
  onLongPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  const { colors, radius } = useTheme();
  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={() => {
          haptic.light();
          onPress?.();
        }}
        onLongPress={() => {
          if (onLongPress) haptic.medium();
          onLongPress?.();
        }}
        delayLongPress={350}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card },
          pressed && { backgroundColor: colors.surfaceHover, transform: [{ scale: 0.995 }] },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.card },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ------------------------------- Chip -------------------------------

export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.selection();
        onPress?.();
      }}
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          paddingHorizontal: 16,
          height: 38,
          borderRadius: 999,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: active ? colors.accent : colors.surfaceAlt,
          borderWidth: 1,
          borderColor: active ? colors.accent : colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      {icon ? <Ionicons name={icon} size={14} color={active ? colors.onAccent : colors.textSecondary} /> : null}
      <Text
        style={{
          color: active ? colors.onAccent : colors.textSecondary,
          fontFamily: UI_FONT_MEDIUM,
          fontSize: 14,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ------------------------------- Segmented -------------------------------

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceAlt,
        borderRadius: radius.button,
        padding: 4,
        gap: 4,
      }}
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => {
              haptic.selection();
              onChange(o.key);
            }}
            style={{
              flex: 1,
              height: 40,
              borderRadius: radius.button - 4,
              backgroundColor: active ? colors.accent : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 8,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: active ? colors.onAccent : colors.textSecondary,
                fontFamily: UI_FONT_SEMIBOLD,
                fontSize: 13,
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ------------------------------- Sheet -------------------------------

export function Sheet({
  visible,
  onClose,
  title,
  children,
  maxWidth = 560,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: number;
}) {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else if (mounted) {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start(() =>
        setMounted(false),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="close" />
        <Animated.View
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            alignItems: 'center',
          }}
        >
          <Animated.View
            style={{
              width: '100%',
              maxWidth,
              backgroundColor: colors.surface,
              borderTopLeftRadius: radius.sheet,
              borderTopRightRadius: radius.sheet,
              paddingTop: 10,
              paddingBottom: insets.bottom + 16,
              paddingHorizontal: 20,
              transform: [
                {
                  translateY: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [420, 0],
                  }),
                },
              ],
              maxHeight: '86%',
            }}
          >
            <View
              style={{
                width: 44,
                height: 5,
                borderRadius: 999,
                backgroundColor: colors.borderStrong,
                alignSelf: 'center',
                marginBottom: 10,
              }}
            />
            {title ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 18 }}>{title}</Text>
                <IconButton icon="close" size={36} onPress={onPressClose(onClose)} />
              </View>
            ) : null}
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {children}
            </ScrollView>
          </Animated.View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function onPressClose(cb: () => void) {
  return () => cb();
}

// ------------------------------- Slider row -------------------------------

export function WpmSlider({
  value,
  min,
  max,
  onChange,
  onCommit,
  label,
  unit,
}: {
  value: number;
  min: number;
  max: number;
  onChange?: (v: number) => void;
  onCommit?: (v: number) => void;
  label?: string;
  unit?: string;
}) {
  const { colors } = useTheme();
  return (
    <View>
      {label ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
          <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 14 }}>{label}</Text>
          <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 16 }}>
            {value}
            {unit ? <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 13 }}> {unit}</Text> : null}
          </Text>
        </View>
      ) : null}
      <Slider
        minimumValue={min}
        maximumValue={max}
        step={10}
        value={value}
        onValueChange={(v) => onChange?.(Math.round(v))}
        onSlidingComplete={(v) => {
          haptic.selection();
          onCommit?.(Math.round(v));
        }}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.borderStrong}
        thumbTintColor={colors.accent}
        style={{ width: '100%', height: 44 }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -6 }}>
        <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 12 }}>{min}</Text>
        <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 12 }}>{max}</Text>
      </View>
    </View>
  );
}

// ------------------------------- SettingRow -------------------------------

export function SettingRow({
  icon,
  label,
  value,
  right,
  onPress,
  destructive,
  sub,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  destructive?: boolean;
  sub?: string;
}) {
  const { colors } = useTheme();
  const inner = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
      }}
    >
      {icon ? (
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            backgroundColor: destructive ? colors.dangerSoft : colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={icon} size={18} color={destructive ? colors.danger : colors.accent} />
        </View>
      ) : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text
          style={{
            color: destructive ? colors.danger : colors.text,
            fontFamily: UI_FONT_MEDIUM,
            fontSize: 15,
          }}
        >
          {label}
        </Text>
        {sub ? (
          <Text style={{ color: colors.textTertiary, fontFamily: UI_FONT_MEDIUM, fontSize: 12 }}>{sub}</Text>
        ) : null}
      </View>
      {value ? (
        <Text style={{ color: colors.textSecondary, fontFamily: UI_FONT_MEDIUM, fontSize: 14 }}>{value}</Text>
      ) : null}
      {right}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={() => { haptic.light(); onPress(); }} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

// ------------------------------- EmptyState -------------------------------

export function EmptyState({
  icon,
  title,
  text,
  actionLabel,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
      <View
        style={{
          width: 88,
          height: 88,
          borderRadius: 28,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <Ionicons name={icon} size={38} color={colors.accent} />
      </View>
      <Text style={{ color: colors.text, fontFamily: UI_FONT_BOLD, fontSize: 18, textAlign: 'center' }}>
        {title}
      </Text>
      {text ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontFamily: UI_FONT_MEDIUM,
            fontSize: 14,
            textAlign: 'center',
            marginTop: 8,
            lineHeight: 21,
          }}
        >
          {text}
        </Text>
      ) : null}
      {actionLabel ? (
        <View style={{ marginTop: 20, alignSelf: 'stretch' }}>
          <Button label={actionLabel} onPress={onAction} icon="add" />
        </View>
      ) : null}
    </View>
  );
}

// ------------------------------- ProgressBar -------------------------------

export function ProgressBar({ progress, height = 8 }: { progress: number; height?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        height,
        borderRadius: 999,
        backgroundColor: colors.surfaceAlt,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${Math.max(2, Math.min(100, progress * 100))}%`,
          height: '100%',
          borderRadius: 999,
          backgroundColor: colors.accent,
        }}
      />
    </View>
  );
}

// ------------------------------- Toast -------------------------------

interface ToastState {
  msg: string;
  kind: 'info' | 'error';
  counter: number;
  show(msg: string, kind?: 'info' | 'error'): void;
}

import { create } from 'zustand';

export const useToast = create<ToastState>((set) => ({
  msg: '',
  kind: 'info',
  counter: 0,
  show(msg, kind = 'info') {
    set((s) => ({ msg, kind, counter: s.counter + 1 }));
  },
}));

export function ToastHost() {
  const { colors, radius } = useTheme();
  const { msg, kind, counter } = useToast();
  const anim = useRef(new Animated.Value(0)).current;
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (counter === 0) return;
    anim.stopAnimation();
    Animated.timing(anim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }, 3200);
  }, [counter, anim]);

  const insets = useSafeAreaInsets();
  if (counter === 0) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: insets.top + 8,
        left: 16,
        right: 16,
        alignItems: 'center',
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-24, 0] }),
          },
        ],
        zIndex: 100,
      }}
    >
      <View
        style={{
          backgroundColor: kind === 'error' ? colors.danger : colors.surfaceAlt,
          borderRadius: radius.button,
          paddingHorizontal: 18,
          paddingVertical: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          shadowColor: '#000',
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
          maxWidth: '100%',
        }}
      >
        <Ionicons
          name={kind === 'error' ? 'alert-circle' : 'checkmark-circle'}
          size={18}
          color={kind === 'error' ? '#fff' : colors.accent}
        />
        <Text
          numberOfLines={3}
          style={{ color: kind === 'error' ? '#fff' : colors.text, fontFamily: UI_FONT_MEDIUM, fontSize: 14 }}
        >
          {msg}
        </Text>
      </View>
    </Animated.View>
  );
}

// ------------------------------- Прочее -------------------------------

export function SectionTitle({ children }: { children: string }) {
  const { colors } = useTheme();
  return (
    <Text
      style={{
        color: colors.textTertiary,
        fontFamily: UI_FONT_SEMIBOLD,
        fontSize: 13,
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        marginBottom: 10,
        marginTop: 6,
      }}
    >
      {children}
    </Text>
  );
}

export function AppTextInput({
  value,
  onChangeText,
  placeholder,
  multiline,
  numberOfLines,
  style,
  keyboardType,
  autoCapitalize,
  autoCorrect = true,
  spellCheck = true,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  multiline?: boolean;
  numberOfLines?: number;
  style?: StyleProp<ViewStyle>;
  keyboardType?: 'default' | 'url' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
  autoCorrect?: boolean;
  spellCheck?: boolean;
}) {
  const { colors, radius } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      multiline={multiline}
      numberOfLines={numberOfLines}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      spellCheck={spellCheck}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={[
        {
          backgroundColor: colors.surfaceAlt,
          borderRadius: radius.button,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          fontFamily: UI_FONT_MEDIUM,
          fontSize: 15,
          paddingHorizontal: 16,
          paddingVertical: 14,
        },
        multiline && { minHeight: 140 },
        style,
      ]}
    />
  );
}

export function useDebouncedCallback<A extends unknown[]>(cb: (...args: A) => void, ms: number) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => cb(...args), ms);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ms],
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
  },
});
