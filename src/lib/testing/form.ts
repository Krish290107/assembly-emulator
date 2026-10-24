import { assembleSource } from '../assembler/index.ts';
import { validateTestDefinition } from './index.ts';
import type { RegisterName, StateAssertion } from '../../types/engine.ts';
import type { TestDefinition } from '../../types/testing.ts';
import { nameKey } from './library.ts';
export interface TestFields { id: string; name: string; description: string; source: string; A: string; B: string; PC: string; SP: string; initialA: string; initialB: string; initialPC: string; initialSP: string; memory: string; initialMemory: string; status: string; fault: string; attempts: string; budget: string }
export function fieldsFor(id: string, source: string, test?: TestDefinition): TestFields {
  const fields: TestFields = { id, name: test?.name ?? '', description: test?.description ?? '', source: test?.source ?? source, A: '', B: '', PC: '', SP: '', initialA: '', initialB: '', initialPC: '', initialSP: '', memory: '', initialMemory: '', status: test?.expectedStatus ?? 'halted', fault: test?.expectedFaultCode ?? '', attempts: test?.expectedAttempts?.toString() ?? '', budget: test?.limits?.maxInstructions.toString() ?? '' };
  for (const a of test?.assertions ?? []) { if (a.target === 'register') fields[a.register] = String(a.expected); else fields.memory += `${a.address} = ${a.expected}\n`; }
  fields.initialMemory = (test?.initialState?.memory ?? []).map(c => `${c.address} = ${c.value}`).join('\n');
  for (const register of ['A','B','PC','SP'] as const) {
    const value = test?.initialState?.registers?.[register];
    if (value !== undefined) fields[`initial${register}`] = String(value);
  }
  return fields;
}
export function integerField(text: string) {
  const s = text.trim(); if (!/^[+-]?(?:\d+|0x[\da-f]+)$/i.test(s)) return null;
  const n = (s.startsWith('-') ? -1 : 1) * Number(s.replace(/^[+-]/, '')); return Number.isSafeInteger(n) ? n : null;
}
export function validateFields(f: TestFields, existing: readonly TestDefinition[]) {
  const errors: Record<string, string> = {};
  const number = (s: string, key: string, min: number, max: number) => { const n = integerField(s); if (n === null || n < min || n > max) { errors[key] = `Use an integer from ${min} to ${max}. Decimal or signed hexadecimal is accepted.`; return 0; } return n; };
  if (!f.name.trim()) errors.name = 'Enter a name.';
  else if (existing.some(t => t.id !== f.id && nameKey(t.name) === nameKey(f.name))) errors.name = 'Choose a unique custom name.';
  const assertions: StateAssertion[] = [];
  const registers: Partial<Record<RegisterName, number>> = {};
  for (const register of ['A','B','PC','SP'] as const) {
    const min = ['A','B'].includes(register) ? -2147483648 : 0, max = register === 'PC' ? 65535 : register === 'SP' ? 65536 : 2147483647;
    if (f[register].trim()) assertions.push({ target: 'register', register, expected: number(f[register], register, min, max) });
    const key = `initial${register}` as const;
    if (f[key].trim()) registers[register] = number(f[key], key, min, max);
  }
  function cells(key: 'memory' | 'initialMemory') {
    const seen = new Set<number>(); const values: { address: number; value: number }[] = [];
    for (const [index, line] of f[key].split(/\r?\n/).entries()) {
      if (!line.trim()) continue;
      const parts = line.split('='); if (parts.length !== 2) { errors[key] = `Line ${index + 1}: use address = value.`; continue; }
      const address = number(parts[0], key, 0, 65535), value = number(parts[1], key, -2147483648, 2147483647);
      if (seen.has(address)) errors[key] = `Duplicate address ${address}; use each address once.`;
      seen.add(address); values.push({ address, value });
    } return values;
  }
  assertions.push(...cells('memory').map(c => ({ target: 'memory' as const, address: c.address, expected: c.value })));
  const memory = cells('initialMemory');
  const budget = f.budget.trim() ? number(f.budget, 'budget', 1, 10000000) : 100000;
  const candidate = { id: f.id, name: f.name.trim(), description: f.description, source: f.source, assertions, expectedStatus: f.status,
    ...(f.fault ? { expectedFaultCode: f.fault } : {}), ...(f.attempts.trim() ? { expectedAttempts: number(f.attempts, 'attempts', 0, budget) } : {}), limits: { maxInstructions: budget }, initialState: { memory, registers } };
  const checked = validateTestDefinition(candidate);
  for (const d of checked.diagnostics) errors[d.path === 'expectedFaultCode' ? 'fault' : d.path === 'expectedStatus' ? 'status' : 'form'] = d.message;
  if (new TextEncoder().encode(f.source).length > 1024 * 1024) errors.source = 'Source exceeds 1 MiB.';
  else {
    const assembled = assembleSource(f.source);
    if (assembled.status === 'failure') errors.source = assembled.diagnostics.map(d => `${d.code}${d.source ? ` at ${d.source.start.line}:${d.source.start.column}` : ''}: ${d.message}`).join(' ');
    else if (!assembled.program.bytes.length) errors.source = 'Enter a program containing instructions or data.';
  }
  return { errors, definition: Object.keys(errors).length ? null : checked.definition };
}
