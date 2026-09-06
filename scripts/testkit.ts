/** Мини-раннер тестов без внешних зависимостей. */

export interface TestContext {
  test: (name: string, fn: () => void | Promise<void>) => void;
}

const suites: { name: string; tests: { name: string; fn: () => void | Promise<void> }[] }[] = [];
let currentSuite: { name: string; tests: { name: string; fn: () => void | Promise<void> }[] } | null =
  null;

export function suite(name: string, fn: (ctx: TestContext) => void): void {
  currentSuite = { name, tests: [] };
  suites.push(currentSuite);
  fn({ test: registerTest });
  currentSuite = null;
}

export function registerTest(name: string, fn: () => void | Promise<void>): void {
  if (!currentSuite) throw new Error(`test "${name}" вне suite()`);
  currentSuite.tests.push({ name, fn });
}

export { registerTest as test };

export function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(`assert failed: ${msg}`);
}

export function assertEq(actual: unknown, expected: unknown, msg = ''): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error(`assertEq failed${msg ? ` (${msg})` : ''}: expected ${b}, got ${a}`);
}

export function assertClose(actual: number, expected: number, eps: number, msg = ''): void {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(
      `assertClose failed${msg ? ` (${msg})` : ''}: expected ~${expected}, got ${actual}`,
    );
  }
}

export async function runAllTests(): Promise<boolean> {
  let passed = 0;
  let failed = 0;
  for (const s of suites) {
    for (const t of s.tests) {
      try {
        await t.fn();
        passed++;
        console.log(`  ✓ ${s.name} > ${t.name}`);
      } catch (e) {
        failed++;
        console.error(`  ✗ ${s.name} > ${t.name}\n    ${(e as Error).message}`);
      }
    }
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  return failed === 0;
}
