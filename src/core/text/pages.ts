/** Синтетические «страницы» для документов без собственной пагинации (TXT/EPUB/URL). */
export const SYNTHETIC_PAGE_SIZE = 230;

export function synthesizePages(wordCount: number, perPage = SYNTHETIC_PAGE_SIZE): number[] {
  if (wordCount <= 0) return [0];
  const pages: number[] = [];
  for (let i = 0; i < wordCount; i += perPage) pages.push(i);
  return pages;
}
