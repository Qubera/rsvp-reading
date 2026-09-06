/**
 * Ежедневное напоминание о чтении (20:00).
 *
 * Native (iOS/Android): expo-notifications — настоящее повторяющееся
 * уведомление, запрошенное разрешение.
 * Web: браузерные Notification API — разрешение + проверка времени каждую
 * минуту (срабатывает, пока вкладка/приложение открыты).
 */

import { Platform } from 'react-native';

const REMINDER_HOUR = 20;
const REMINDER_MINUTE = 0;
const STORE_KEY = 'reminder:lastShown';

let webTimer: ReturnType<typeof setInterval> | null = null;

function todayAt(h: number, m: number): Date {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

async function enableWeb(): Promise<boolean> {
  const g = globalThis as unknown as {
    Notification?: {
      requestPermission: (cb?: (p: string) => void) => Promise<string> | string;
    };
    localStorage?: Storage;
  };
  if (!g.Notification) return false;
  let perm: string = Notification.permission;
  if (perm === 'default') {
    perm = await Promise.race([
      Notification.requestPermission(),
      new Promise<string>((r) => setTimeout(() => r(Notification.permission), 8000)),
    ]);
  }
  if (perm !== 'granted') return false;

  if (webTimer) clearInterval(webTimer);
  webTimer = setInterval(() => {
    const now = new Date();
    const due = todayAt(REMINDER_HOUR, REMINDER_MINUTE);
    const last = Number(g.localStorage?.getItem(STORE_KEY) ?? 0);
    if (now >= due && last < due.getTime()) {
      g.localStorage?.setItem(STORE_KEY, String(Date.now()));
      try {
        new Notification('RSVP Reading', {
          body: 'Пора читать — 10 минут в день сильно ускоряют навык.',
        });
      } catch {
        // некоторые браузеры требуют Service Worker — молча пропускаем
      }
    }
  }, 60_000);
  return true;
}

export const readingReminder = {
  /** Включить напоминание; возвращает granted/не удалось. */
  async enable(): Promise<boolean> {
    if (Platform.OS === 'web') return enableWeb();
    const Notifications = await import('expo-notifications');
    const perm = await Notifications.getPermissionsAsync();
    const granted = perm.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'RSVP Reading',
        body: 'Пора читать — 10 минут в день сильно ускоряют навык.',
      },
      trigger: { type: 'daily', hour: REMINDER_HOUR, minute: REMINDER_MINUTE } as never,
    });
    return true;
  },

  async disable(): Promise<void> {
    if (Platform.OS === 'web') {
      if (webTimer) {
        clearInterval(webTimer);
        webTimer = null;
      }
      return;
    }
    const Notifications = await import('expo-notifications');
    await Notifications.cancelAllScheduledNotificationsAsync();
  },
};
