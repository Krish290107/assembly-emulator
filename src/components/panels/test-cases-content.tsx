"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createTestPanelController, resultLabel } from '@/lib/testing/panel-controller';
import { PREDEFINED_TEST_CASES } from '@/lib/testing/fixtures';
import { mergeTests, readTestFile, serializeTests, uniqueId } from '@/lib/testing/library';
import type { TestDefinition, TestResult } from '@/types/testing';
import { TestCaseForm } from './test-case-form';
import type { ReactNode } from 'react';
export const TEST_PAGE_SIZE = 100;
export function TestPage<Item>({ items, label, render }: { items: readonly Item[]; label: string; render: (item: Item, index: number) => ReactNode }) {
  const [requested, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / TEST_PAGE_SIZE));
  const page = Math.min(requested, pages - 1), start = page * TEST_PAGE_SIZE;
  return <>{items.slice(start, start + TEST_PAGE_SIZE).map((item,index) => render(item,start + index))}{pages > 1 && <li className="test-actions" aria-label={`${label} pages`}><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous {label}</button><span>{start + 1}–{Math.min(start + TEST_PAGE_SIZE,items.length)} of {items.length}</span><button type="button" disabled={page + 1 === pages} onClick={() => setPage(page + 1)}>Next {label}</button></li>}</>;
}
function download(raw: string, filename = 'assembly-emulator-tests.json') {
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json;charset=utf-8' }));
  try { const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); }
  finally { window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
export function TestResultDetails({ result }: { result: TestResult }) {
  const [requested, setPage] = useState(0);
  const pages = Math.max(1,Math.ceil(result.assertions.length / TEST_PAGE_SIZE));
  const page = Math.min(requested,pages - 1), start = page * TEST_PAGE_SIZE;
  return <details open={result.outcome === 'FAIL'}><summary>{resultLabel(result)} · {result.executionStatus ?? 'not executed'} · {result.attemptedInstructions} attempts</summary><div className="test-table" tabIndex={0} aria-label="Assertion results"><table><thead><tr><th>Target</th><th>Expected</th><th>Actual</th><th>Result</th></tr></thead><tbody>{result.assertions.slice(start,start + TEST_PAGE_SIZE).map((a,i) => <tr key={start + i}><th scope="row">{a.label}</th><td>{a.expected}</td><td>{a.actual ?? '—'}</td><td>{a.outcome}</td></tr>)}</tbody></table></div>{pages > 1 && <div className="test-actions" role="group" aria-label="Assertion result pages"><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous assertions</button><span>{start + 1}–{Math.min(start + TEST_PAGE_SIZE,result.assertions.length)} of {result.assertions.length}</span><button type="button" disabled={page + 1 === pages} onClick={() => setPage(page + 1)}>Next assertions</button></div>}<ul><TestPage items={result.failureReasons} label="failure reasons" render={(s,i) => <li key={i}>{s}</li>} /></ul><ul><TestPage items={result.diagnostics} label="diagnostics" render={(d,i) => <li key={i}><code>{d.code}</code>{d.source ? ` at ${d.source.start.line}:${d.source.start.column}` : ''}: {d.message}</li>} /></ul></details>;
}
export function TestCasesContent({ source }: { source: string }) {
  const [controller] = useState(() => createTestPanelController({ schedule: (fn,delay) => window.setTimeout(fn,delay), cancel: id => window.clearTimeout(id as number) }));
  const state = useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getServerSnapshot);
  const [editing,setEditing] = useState<{id:string;test?:TestDefinition}|null>(null), [reading,setReading] = useState(false), [replace,setReplace] = useState(false), [message,setMessage] = useState('');
  const upload = useRef<HTMLInputElement>(null), lifetime = useRef(0);
  useEffect(() => { const token = ++lifetime.current; try { controller.initialize(window.localStorage); } catch { controller.initialize(); } return () => { if(lifetime.current === token) lifetime.current = token + 1; controller.dispose(); }; },[controller]);
  const locked = !state.ready || state.running || reading || !!editing;
  async function importFile(file?: File) {
    if (!file || locked) return; const token = lifetime.current; setReading(true); setMessage('');
    try { const tests = await readTestFile(file); if (lifetime.current !== token) return; const plan = mergeTests(controller.getSnapshot().custom,tests,replace);
      if(window.confirm(`${replace ? 'Replace all custom tests' : 'Merge tests'}? ${tests.length} incoming; ${plan.renamed} conflicts renamed; final count ${plan.tests.length}. No automatic execution.`)) controller.importTests(tests,replace);
    } catch(error) { if(lifetime.current === token) setMessage((error as Error).message); }
    finally { if(lifetime.current === token) setReading(false); }
  }
  function card(test: TestDefinition, custom = false) {
    const result = state.results.find(r => r.id === test.id);
    return <article className="test-card" key={test.id}><h4>{test.name} <span>{state.activeId === test.id ? 'Running' : result ? resultLabel(result) : 'Not run'}</span></h4><p>{test.description || `${test.assertions.length} state assertions; expects ${test.expectedStatus ?? 'halted'}.`}</p>
      <div className="test-actions"><button disabled={locked} onClick={() => controller.run([test.id])} aria-label={`Run ${test.name}`}>Run</button>{custom && <><button disabled={locked} onClick={() => { controller.beginEdit(test.id); setEditing({id:test.id,test}); }}>Edit</button><button disabled={locked} onClick={() => controller.duplicate(test.id)}>Duplicate</button><button disabled={locked} onClick={() => { if(window.confirm(`Delete ${test.name}? Export a backup first if needed.`)) controller.remove(test.id); }}>Delete</button></>}</div>
      <details><summary>Program &amp; expectations</summary><pre>{test.source}</pre><ul><li>Status: {test.expectedStatus ?? 'halted'} {test.expectedFaultCode}</li>{test.expectedAttempts !== undefined && <li>Attempts: {test.expectedAttempts}</li>}<TestPage items={test.assertions} label="expectations" render={(a,i) => <li key={i}>{a.target === 'register' ? a.register : `Memory[${a.address}]`} = {a.expected}</li>} /></ul><p>Budget: {test.limits?.maxInstructions ?? 100000}</p>{test.initialState && <pre>Initial inputs: {JSON.stringify(test.initialState,null,2)}</pre>}</details>
      {result && <TestResultDetails result={result} />}</article>;
  }
  return <div className="test-workspace"><p>Tests use independent CPUs and source snapshots. Your editor and debugger remain separate.</p>
    {!state.ready && <p role="status">Loading custom tests…</p>}{(message || state.notice) && <p role="status">{message || state.notice}</p>}
    <div role="status" className="test-progress">{state.running ? `Running ${state.activeId}: ${state.attempts} attempts` : 'Test runner idle'}<p>Total {state.total} · Completed {state.completed} · Passed {state.passed} · Failed {state.failed} (includes {state.cancelled} cancelled, {state.errors} errors)</p></div>
    {state.running && <button onClick={controller.cancel}>Cancel test run</button>}
    <section><h3 id="tests-predefined" tabIndex={-1}>Predefined Tests</h3><button disabled={locked} onClick={() => controller.run(PREDEFINED_TEST_CASES.map(t => t.id))}>Run all predefined (14)</button>{PREDEFINED_TEST_CASES.map(t => card(t))}</section>
    <section><h3 id="tests-custom" tabIndex={-1}>Custom Tests ({state.custom.length}/100)</h3><p>{state.storage === 'saved' ? 'Definitions save locally when changed.' : 'Storage unavailable/protected: export a backup.'} Results are not persisted.</p>
      <div className="test-actions"><button disabled={locked || state.custom.length >= 100} onClick={() => setEditing({id:uniqueId(state.custom)})}>Create custom test</button><button disabled={locked || !state.custom.length} onClick={() => controller.run(state.custom.map(t => t.id))}>Run all custom</button><button disabled={!state.ready} onClick={() => { try { download(serializeTests(state.custom)); setMessage('JSON download requested. Check browser downloads.'); } catch(error) { setMessage((error as Error).message); } }}>Export custom tests</button></div>
      <div className="test-actions"><label>Import mode <select name="test-import-mode" disabled={locked} value={replace ? 'replace':'merge'} onChange={e => setReplace(e.target.value === 'replace')}><option value="merge">Merge, rename conflicts</option><option value="replace">Replace all custom</option></select></label><button disabled={locked} onClick={() => upload.current?.click()}>{reading ? 'Reading…':'Import custom tests'}</button><input name="test-import-file" className="sr-only" tabIndex={-1} aria-label="Import test JSON" ref={upload} type="file" accept=".json" onChange={e => { const file=e.target.files?.[0]; e.target.value=''; void importFile(file); }} /></div>
      {(state.storage === 'protected' || state.storage === 'unavailable') && <div className="test-actions">{state.backup !== null && <button onClick={() => { try { download(state.backup!,'assembly-emulator-tests-backup.json'); } catch { setMessage('Backup download failed. Original data is untouched.'); } }}>Download original saved data</button>}<button disabled={locked} onClick={() => { if(window.confirm('Replace saved data with current tests? Export current tests and download original data first if needed.')) { try { controller.replaceStorage(window.localStorage); } catch { setMessage('Storage unavailable; export instead.'); } } }}>Save current tests locally…</button></div>}
      {editing && <TestCaseForm key={editing.id} {...editing} source={source} existing={state.custom} onSave={controller.save} onClose={() => setEditing(null)} />}
      {!state.custom.length && <p>No custom tests. Create from the editor source or import a JSON library.</p>}{state.custom.map(t => card(t,true))}</section>
  </div>;
}
