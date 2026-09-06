export type LanguageCode = 'ru' | 'kk' | 'en';

const NBSP = '\u00A0';

export function formatNumber(n: number): string {
  const s = Math.abs(Math.round(n)).toString();
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 === 0) out += NBSP;
    out += s[i];
  }
  return (n < 0 ? '-' : '') + out;
}

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function wordsLabel(n: number, lang: LanguageCode): string {
  if (lang === 'en') return n === 1 ? 'word' : 'words';
  if (lang === 'kk') return 'сөз';
  return pluralRu(n, 'слово', 'слова', 'слов');
}

/** «5 ч 42 мин», «42 мин», «35 с» */
export function formatDuration(ms: number, lang: LanguageCode = 'ru'): string {
  const totalSec = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(lang === 'en' ? `${h} h` : lang === 'kk' ? `${h} сағ` : `${h} ч`);
  if (m > 0) parts.push(lang === 'en' ? `${m} min` : `${m} мин`);
  if (parts.length === 0 || (parts.length === 1 && h === 0 && s > 0 && m === 0)) {
    if (s > 0 && parts.length === 0) parts.push(lang === 'en' ? `${s} s` : `${s} с`);
  }
  return parts.join(' ') || (lang === 'en' ? '0 s' : '0 с');
}

export function formatMMSS(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const MONTHS: Record<LanguageCode, string[]> = {
  ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
  kk: ['қаң', 'ақп', 'нау', 'сәу', 'мам', 'мау', 'шіл', 'там', 'қыр', 'қаз', 'қар', 'жел'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};

export function formatDateShort(ts: number, lang: LanguageCode = 'ru'): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[lang][d.getMonth()]}`;
}

/** Дни недели, начиная с понедельника. */
export function weekdayLabels(lang: LanguageCode): string[] {
  if (lang === 'en') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  if (lang === 'kk') return ['Дс', 'Сс', 'Ср', 'Бс', 'Жм', 'Сб', 'Жс'];
  return ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
}
