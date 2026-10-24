"use client";
import { useId, useState } from 'react';
import { fieldsFor, validateFields, type TestFields } from '@/lib/testing/form';
import { TEST_FAULT_CODES } from '@/lib/testing/validation';
import type { TestDefinition } from '@/types/testing';
export function TestCaseForm({ id, source, test, existing, onSave, onClose }: { id: string; source: string; test?: TestDefinition; existing: readonly TestDefinition[]; onSave: (t: TestDefinition) => boolean; onClose: () => void }) {
  const [fields, setFields] = useState(() => fieldsFor(id, source, test)); const [errors, setErrors] = useState<Record<string,string>>({}); const prefix = useId();
  const update = (key: keyof TestFields, value: string) => setFields(f => ({ ...f, [key]: value }));
  function input(key: keyof TestFields, label: string, multiline = false) {
    const props = { id: `${prefix}-${key}`, value: fields[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(key, e.target.value), 'aria-invalid': !!errors[key], 'aria-describedby': errors[key] ? `${prefix}-${key}-error` : undefined };
    return <label className="test-field" key={key} htmlFor={props.id}>{label}{multiline ? <textarea {...props} rows={key === 'source' ? 7 : 3} spellCheck={false} /> : <input {...props} autoComplete="off" />}{errors[key] && <span id={`${prefix}-${key}-error`} className="test-error">{errors[key]}</span>}</label>;
  }
  return <form className="test-form" aria-label="Custom test editor" onSubmit={e => { e.preventDefault(); const r = validateFields(fields, existing); setErrors(r.errors); if (r.definition && onSave(r.definition)) onClose(); }} noValidate>
    <h4>{test ? 'Edit' : 'Create'} custom test</h4>{Object.keys(errors).length > 0 && <p role="alert" className="test-error">Fix the marked fields. {errors.form}</p>}
    {input('name','Name')}{input('description','Description (optional)')}{input('source','Assembly source snapshot',true)}
    <button type="button" onClick={() => { if (window.confirm('Replace this test source with the current editor source?')) update('source',source); }}>Copy current editor source</button>
    <p>Blank registers are ignored; zero is explicit. HALT is always checked by default.</p><div className="test-fields">{(['A','B','PC','SP'] as const).map(k => input(k,`Expected ${k} (optional)`))}</div>
    {input('memory','Expected memory: one address = value per line',true)}
    <label className="test-field">Expected completion<select name="expected-status" value={fields.status} aria-invalid={!!errors.status} aria-describedby={errors.status ? `${prefix}-status-error` : undefined} onChange={e => setFields(f => ({...f,status:e.target.value,fault:''}))}><option value="halted">HALT</option><option value="error">Runtime error</option><option value="limit-reached">Limit reached</option></select>{errors.status && <span id={`${prefix}-status-error`} className="test-error">{errors.status}</span>}</label>
    {fields.status === 'error' && <label className="test-field">Exact fault code<select name="expected-fault-code" value={fields.fault} onChange={e => update('fault',e.target.value)} aria-invalid={!!errors.fault} aria-describedby={errors.fault ? `${prefix}-fault-error` : undefined}><option value="">Choose code</option>{TEST_FAULT_CODES.map(c => <option key={c}>{c}</option>)}</select>{errors.fault && <span id={`${prefix}-fault-error`} className="test-error">{errors.fault}</span>}</label>}
    {input('attempts','Expected attempts (optional)')}{input('budget','Budget (default 100,000; max 10,000,000)')}{input('initialMemory','Initial memory: one address = value per line',true)}
    <p>Initial registers are inputs applied after loading, before execution. Blank uses the CPU default; zero is explicit.</p><div className="test-fields">{(['A','B','PC','SP'] as const).map(k => input(`initial${k}`,`Initial ${k} (optional)`))}</div>
    <div className="test-actions"><button type="submit">Save test</button><button type="button" onClick={onClose}>Cancel editing</button></div>
  </form>;
}
