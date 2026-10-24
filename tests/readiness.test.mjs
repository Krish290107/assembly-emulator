import assert from 'node:assert/strict';
import { test } from 'node:test';
import { performance } from 'node:perf_hooks';
import { createTestPanelController } from '../src/lib/testing/panel-controller.ts';
import { parseTests, serializeTests, readTestFile, MAX_LIBRARY_BYTES } from '../src/lib/testing/library.ts';
const definition=(id)=>({id,name:id,source:'ldc 10\nadc 5\nHALT',assertions:[{target:'register',register:'A',expected:15}],expectedAttempts:3});
test('maximum 100-case suite stays sequential, bounded and deterministic across repeated runs',t=>{
  const pending=new Map();let handle=0,callbacks=0;
  const c=createTestPanelController({schedule(fn){assert.equal(pending.size,0);pending.set(++handle,fn);return handle;},cancel(id){pending.delete(id);}});
  c.initialize({getItem:()=>null,setItem(){}});
  const cases=Array.from({length:100},(_,i)=>definition(`case-${i}`));assert.equal(c.importTests(cases,true),true);
  const started=performance.now();let first;
  for(let run=0;run<3;run++){
    assert.equal(c.run(cases.map(x=>x.id)),true);
    while(pending.size){const[id,fn]=pending.entries().next().value;pending.delete(id);fn();callbacks++;}
    const state=c.getSnapshot();assert.equal(state.completed,100);assert.equal(state.passed,100);assert.equal(state.failed,0);assert.equal(state.results.length,100);
    if(!first)first=structuredClone(state.results);else assert.deepEqual(state.results,first);
  }
  assert.equal(callbacks,300);t.diagnostic(`Three 100-case suites: ${(performance.now()-started).toFixed(1)} ms with injected timers (not browser timing).`);
});
test('untrusted prototype keys reject whole imports and recover good saved entries safely',()=>{
  const bad=JSON.parse('{"id":"bad","name":"bad","source":"HALT","assertions":[],"__proto__":{"polluted":true}}');
  const raw=JSON.stringify({format:'assembly-emulator-tests',version:1,tests:[definition('good'),bad]});
  assert.equal(parseTests(raw).tests.length,0);const recovered=parseTests(raw,true);assert.equal(recovered.tests.length,1);assert.ok(recovered.errors.length);assert.equal({}.polluted,undefined);
  assert.throws(()=>serializeTests(Array.from({length:101},(_,i)=>definition(String(i)))));
});
test('invalid UTF-8 and oversized imports reject before altering any definitions',async()=>{
  const file={name:'tests.json',size:2,arrayBuffer:async()=>new Uint8Array([0xc3,0x28]).buffer};
  await assert.rejects(readTestFile(file));let read=false;
  await assert.rejects(readTestFile({...file,size:MAX_LIBRARY_BYTES+1,arrayBuffer:async()=>{read=true;return new ArrayBuffer(0);}}));assert.equal(read,false);
});
test('editing during a queued run invalidates the result and prevents a stale callback from executing',()=>{
  const pending=new Map();let id=0;const callbacks=[];
  const c=createTestPanelController({schedule(fn){pending.set(++id,fn);callbacks.push(fn);return id;},cancel(key){pending.delete(key);}});
  c.initialize({getItem:()=>null,setItem(){}});c.save(definition('edit'));c.run(['edit']);const stale=callbacks[0];
  c.save({...definition('edit'),assertions:[{target:'register',register:'A',expected:20}]});stale();assert.equal(c.getSnapshot().results.length,0);assert.equal(pending.size,0);
  c.run(['edit']);const[key,fn]=pending.entries().next().value;pending.delete(key);fn();assert.equal(c.getSnapshot().results[0].outcome,'FAIL');assert.equal(c.getSnapshot().results[0].assertions.at(-1).actual,15);
});
