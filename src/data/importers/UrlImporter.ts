/** Импорт веб-страницы: fetch + извлечение текста. Требует интернет только на момент импорта. */

import { htmlToText } from './html';

export interface UrlResult {
  title: string;
  text: string;
  url: string;
}

function normalizeUrl(input: string): string {
  let url = input.trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url;
}

export async function importFromUrl(input: string): Promise<UrlResult> {
  const url = normalizeUrl(input);
  let host = '';
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error('INVALID_URL');
  }

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; RSVPReading/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType && !contentType.includes('html') && !contentType.includes('xml')) {
    throw new Error('NOT_HTML');
  }
  const html = await response.text();
  const { title, text } = htmlToText(html);
  if (!text || text.length < 40) throw new Error('NO_TEXT');
  return { title: title || host, text, url };
}
