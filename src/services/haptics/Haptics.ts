/** Обёртка над expo-haptics: мягкие паттерны для ключевых действий. */

import * as Haptics from 'expo-haptics';

let enabled = true;

export function setHapticsEnabled(v: boolean) {
  enabled = v;
}

async function guard(fn: () => Promise<void>) {
  if (!enabled) return;
  try {
    await fn();
  } catch {
    // haptics недоступен (эмулятор/веб) — молча игнорируем
  }
}

export const haptic = {
  light: () => guard(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => guard(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  heavy: () => guard(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => guard(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => guard(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  selection: () => guard(() => Haptics.selectionAsync()),
};
