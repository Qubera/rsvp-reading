let counter = 0;

/** Уникальный id без внешних зависимостей (работает офлайн). */
export function generateId(): string {
  counter = (counter + 1) % 1000;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}
