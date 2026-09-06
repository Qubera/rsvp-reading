/** Хелперы пагинации: реальные страницы PDF → индексы слов. */

import { parseText } from '../../core/text/TextParser';

export function pageStartsFromPageTexts(pageTexts: string[]): number[] {
  const starts: number[] = [];
  let acc = 0;
  for (const page of pageTexts) {
    starts.push(acc);
    acc += parseText(page).words.length;
  }
  return starts;
}
