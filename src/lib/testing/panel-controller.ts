import { createTestExecution, validateTestDefinition } from './index.ts';
import { PREDEFINED_TEST_CASES } from './fixtures.ts';
import { TEST_STORAGE_KEY, parseTests, serializeTests, mergeTests, uniqueId, uniqueName, nameKey } from './library.ts';
import type { TestDefinition, TestExecution, TestResult } from '../../types/testing.ts';
type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;
export interface PanelState {
  ready: boolean; custom: readonly TestDefinition[]; results: readonly TestResult[];
  running: boolean; activeId: string | null; attempts: number; total: number; completed: number;
  passed: number; failed: number; cancelled: number; errors: number;
  notice: string; storage: 'loading' | 'saved' | 'protected' | 'unavailable'; backup: string | null;
}
export const INITIAL_PANEL: PanelState = { ready: false, custom: [], results: [], running: false, activeId: null, attempts: 0, total: 0, completed: 0, passed: 0, failed: 0, cancelled: 0, errors: 0, notice: '', storage: 'loading', backup: null };
export function resultLabel(r: TestResult) { return r.cancelled ? 'Cancelled' : r.outcome === 'PASS' ? 'PASS' : r.phase !== 'assertions' || r.executionStatus === 'error' ? 'Error' : 'FAIL'; }
export function createTestPanelController(clock: { schedule: (fn: () => void, delay: number) => unknown; cancel: (id: unknown) => void }) {
  let state = INITIAL_PANEL, disposed = false, generation = 0, timer: unknown = null;
  const listeners = new Set<() => void>();
  let storage: StorageAccess | undefined, original: string | null = null, protectedData = false;
  let queue: TestDefinition[] = [], index = 0, active: TestExecution | null = null;
  const publish = (patch: Partial<PanelState>) => { state = { ...state, ...patch }; if (!disposed) listeners.forEach(fn => fn()); };
  function persist(force = false) {
    if (!storage) { publish({ storage: 'unavailable', notice: 'Storage unavailable. Export your tests to keep them.' }); return; }
    if (protectedData && !force) { publish({ storage: 'protected', notice: 'Original saved data is protected. Export your current tests or explicitly replace saved data.' }); return; }
    try {
      const raw = serializeTests(state.custom), existing = storage.getItem(TEST_STORAGE_KEY);
      if (!force && existing !== original) { protectedData = true; publish({ storage: 'protected', backup: existing, notice: 'Saved data changed in another tab. It was not overwritten.' }); return; }
      if (raw !== existing) storage.setItem(TEST_STORAGE_KEY, raw);
      original = raw; protectedData = false; publish({ storage: 'saved', backup: null });
    } catch { publish({ storage: 'unavailable', notice: 'Saving failed (unavailable/full storage). Tests remain in memory; export a backup.' }); }
  }
  function collect(result: TestResult) {
    publish({ results: [...state.results.filter(r => r.id !== result.id), result], completed: state.completed + 1,
      passed: state.passed + Number(result.outcome === 'PASS'), failed: state.failed + Number(result.outcome === 'FAIL'),
      cancelled: state.cancelled + Number(result.cancelled), errors: state.errors + Number(resultLabel(result) === 'Error') });
  }
  function cancel() {
    generation++; if (timer !== null) clock.cancel(timer); timer = null;
    if (state.running) {
      for (; index < queue.length; index++) { collect((active ?? createTestExecution(queue[index])).cancel().result!); active = null; }
      publish({ running: false, activeId: null, attempts: 0, notice: 'Unfinished tests cancelled; completed results remain valid.' });
    }
  }
  function invalidate(id?: string) { cancel(); publish({ results: id ? state.results.filter(r => r.id !== id) : [], total: 0, completed: 0, passed: 0, failed: 0, cancelled: 0, errors: 0 }); }
  function schedule(token: number) {
    timer = clock.schedule(() => {
      if (disposed || token !== generation || !state.running) return;
      timer = null; active ??= createTestExecution(queue[index]);
      const progress = active.advance();
      if (progress.done) { collect(progress.result!); index++; active = null; publish({ running: index < queue.length, activeId: queue[index]?.id ?? null, attempts: 0 }); }
      else publish({ attempts: progress.attemptedInstructions });
      if (state.running && token === generation && !disposed) schedule(token);
    }, 8);
  }
  function save(input: unknown) {
    if (disposed || !state.ready) return false;
    const checked = validateTestDefinition(input), t = checked.definition;
    if (!t) { publish({ notice: checked.diagnostics.map(d => d.message).join(' ') }); return false; }
    if (PREDEFINED_TEST_CASES.some(p => p.id === t.id) || state.custom.some(p => p.id !== t.id && nameKey(p.name) === nameKey(t.name))) { publish({ notice: 'Use a unique custom ID and name.' }); return false; }
    const custom = state.custom.some(p => p.id === t.id) ? state.custom.map(p => p.id === t.id ? t : p) : [...state.custom, t];
    try { serializeTests(custom); } catch (error) { publish({ notice: (error as Error).message }); return false; }
    invalidate(t.id); publish({ custom, notice: 'Test saved.' }); persist(); return true;
  }
  return {
    getSnapshot: () => state, getServerSnapshot: () => INITIAL_PANEL,
    subscribe(fn: () => void) { disposed = false; listeners.add(fn); return () => { listeners.delete(fn); }; },
    initialize(target?: StorageAccess) {
      disposed = false; if (state.ready) return; storage = target;
      try {
        if (!storage) throw Error(); original = storage.getItem(TEST_STORAGE_KEY);
        const parsed = original === null ? { tests: [], errors: [] } : parseTests(original, true);
        const custom = parsed.tests.filter(t => !PREDEFINED_TEST_CASES.some(p => p.id === t.id));
        if (custom.length !== parsed.tests.length) parsed.errors.push('Reserved fixture IDs were preserved in the original saved data.');
        protectedData = !!parsed.errors.length;
        publish({ ready: true, custom, storage: protectedData ? 'protected' : 'saved', backup: protectedData ? original : null, notice: parsed.errors.join(' ') });
      } catch { protectedData = true; publish({ ready: true, storage: 'unavailable', notice: 'Storage could not be restored. Original data was not changed.' }); }
    },
    save, beginEdit(id: string) { if (!disposed) invalidate(id); },
    duplicate(id: string) { const t = state.custom.find(t => t.id === id); return t ? save({ ...t, id: uniqueId(state.custom), name: uniqueName(state.custom, `${t.name} copy`) }) : false; },
    remove(id: string) { if (disposed) return; invalidate(id); publish({ custom: state.custom.filter(t => t.id !== id), notice: 'Test deleted.' }); persist(); },
    importTests(tests: readonly TestDefinition[], replace: boolean) {
      if (disposed || !state.ready) return false;
      try { const plan = mergeTests(state.custom, tests, replace); invalidate(); publish({ custom: plan.tests, notice: `Imported ${tests.length} tests; ${plan.renamed} conflicts renamed. Nothing executed.` }); persist(); return true; }
      catch (error) { publish({ notice: (error as Error).message }); return false; }
    },
    replaceStorage(target: StorageAccess) { if (!disposed) { storage = target; persist(true); } },
    run(ids: readonly string[]) {
      if (disposed || !state.ready || state.running || !ids.length) return false;
      const all: readonly TestDefinition[] = [...PREDEFINED_TEST_CASES, ...state.custom];
      const selected = [...new Set(ids)].map(id => all.find(t => t.id === id)); if (selected.some(t => !t)) return false;
      queue = structuredClone(selected as TestDefinition[]); index = 0; active = null;
      publish({ running: true, activeId: queue[0].id, attempts: 0, total: queue.length, completed: 0, passed: 0, failed: 0, cancelled: 0, errors: 0, notice: '', results: state.results.filter(r => !ids.includes(r.id)) });
      schedule(++generation); return true;
    }, cancel,
    dispose() { disposed = true; listeners.clear(); cancel(); },
  };
}
