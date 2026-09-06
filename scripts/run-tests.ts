import { runAllTests } from './testkit';

// Импорт всех наборов
import './tests/parser.test';
import './tests/timeline.test';
import './tests/engine.test';
import './tests/decode.test';
import './tests/importers.test';
import './tests/stats.test';

async function main(): Promise<void> {
  const ok = await runAllTests();
  if (!ok) process.exit(1);
}

void main();
