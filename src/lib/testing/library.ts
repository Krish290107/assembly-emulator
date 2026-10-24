import { validateTestDefinition } from './index.ts';
import type { TestDefinition } from '../../types/testing.ts';
import { PREDEFINED_TEST_CASES } from './fixtures.ts';
export const TEST_STORAGE_KEY = 'assembly-emulator:tests:v1';
export const MAX_LIBRARY_BYTES = 2 * 1024 * 1024;
export const nameKey = (name: string) => name.trim().toLowerCase();
export function uniqueId(tests: readonly TestDefinition[], base = 'custom') {
  const ids = new Set([...tests, ...PREDEFINED_TEST_CASES].map(t => t.id));
  let id = base, n = 2; while (ids.has(id)) id = `${base}-${n++}`; return id;
}
export function uniqueName(tests: readonly TestDefinition[], base: string) {
  let name = base, n = 2; while (tests.some(t => nameKey(t.name) === nameKey(name))) name = `${base} (${n++})`; return name;
}
export function validateLibrary(tests: readonly unknown[], recover = false) {
  const valid: TestDefinition[] = [], errors: string[] = [];
  if (tests.length > 100) return { tests: [], errors: ['At most 100 custom tests are allowed.'] };
  for (const [index, input] of tests.entries()) {
    const checked = validateTestDefinition(input), t = checked.definition;
    if (!t) errors.push(`Test ${index + 1}: ${checked.diagnostics.map(d => d.message).join(' ')}`);
    else if (valid.some(v => v.id === t.id || nameKey(v.name) === nameKey(t.name))) errors.push(`Test ${index + 1}: duplicate ID or name.`);
    else if (new TextEncoder().encode(t.source).length > 1024 * 1024) errors.push(`Test ${index + 1}: source exceeds 1 MiB.`);
    else valid.push(t);
  }
  return { tests: errors.length && !recover ? [] : valid, errors };
}
export function serializeTests(tests: readonly TestDefinition[]) {
  const checked = validateLibrary(tests);
  if (checked.errors.length) throw new Error(checked.errors.join(' '));
  const raw = JSON.stringify({ format: 'assembly-emulator-tests', version: 1, tests: checked.tests }, null, 2);
  if (new TextEncoder().encode(raw).length > MAX_LIBRARY_BYTES) throw new Error('Test library exceeds 2 MiB.');
  return raw;
}
export function parseTests(raw: string, recover = false): { tests: TestDefinition[]; errors: string[] } {
  try {
    if (new TextEncoder().encode(raw).length > MAX_LIBRARY_BYTES) throw new Error('JSON exceeds 2 MiB.');
    const data = JSON.parse(raw);
    if (!data || data.format !== 'assembly-emulator-tests' || data.version !== 1 || !Array.isArray(data.tests) || Object.keys(data).some(k => !['format', 'version', 'tests'].includes(k))) throw new Error('Expected assembly-emulator-tests version 1 JSON.');
    return validateLibrary(data.tests, recover);
  } catch (error) { return { tests: [], errors: [(error as Error).message] }; }
}
export function mergeTests(current: readonly TestDefinition[], incoming: readonly TestDefinition[], replace: boolean) {
  const checked = validateLibrary(incoming); if (checked.errors.length) throw new Error(checked.errors.join(' '));
  const tests = replace ? [] : structuredClone([...current]); let renamed = 0;
  for (const item of checked.tests) {
    const id = uniqueId(tests, item.id), name = uniqueName(tests, item.name);
    if (id !== item.id || name !== item.name) renamed++;
    tests.push({ ...item, id, name });
  }
  serializeTests(tests); return { tests, renamed };
}
export async function readTestFile(file: Pick<File, 'name' | 'size' | 'arrayBuffer'>) {
  if (!/\.json$/i.test(file.name) || file.size > MAX_LIBRARY_BYTES) throw new Error('Choose a UTF-8 .json file up to 2 MiB.');
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  const parsed = parseTests(raw); if (parsed.errors.length) throw new Error(parsed.errors.join(' ')); return parsed.tests;
}
