import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createTestPanelController } from '../src/lib/testing/panel-controller.ts';
import { PREDEFINED_TEST_CASES } from '../src/lib/testing/fixtures.ts';
import { fieldsFor, validateFields, integerField } from '../src/lib/testing/form.ts';
import { serializeTests, parseTests, mergeTests, readTestFile } from '../src/lib/testing/library.ts';
import { createWorkspaceController } from '../src/lib/workspace/controller.ts';
const sample = (id='custom') => ({ id, name:id, source:'ldc 10\nadc 5\nHALT', assertions:[{target:'register',register:'A',expected:15}], expectedAttempts:3 });
function setup(raw=null) {
  let next=0,writes=0; const pending=new Map(), callbacks=[];
  const clock={ schedule(fn){pending.set(++next,fn);callbacks.push(fn);return next;},cancel(id){pending.delete(id);} };
  const storage={getItem:()=>raw,setItem(_,value){raw=value;writes++;}};
  const controller=createTestPanelController(clock);controller.initialize(storage);
  const tick=()=>{const [id,fn]=pending.entries().next().value;pending.delete(id);fn();};
  const drain=()=>{let count=0;while(pending.size && count++<2000)tick();assert.equal(pending.size,0);};
  return {controller,clock,storage,pending,callbacks,tick,drain,raw:()=>raw,writes:()=>writes,external(value){raw=value;}};
}
test('fourteen fixtures run independently in order with exact summary',()=>{
  const s=setup();assert.equal(s.controller.run(PREDEFINED_TEST_CASES.map(t=>t.id)),true);assert.equal(s.controller.run(['halt']),false);s.drain();
  const v=s.controller.getSnapshot();assert.equal(v.passed,14);assert.equal(v.failed,0);assert.equal(v.completed,14);assert.deepEqual(v.results.map(t=>t.id),PREDEFINED_TEST_CASES.map(t=>t.id));
});
test('create edit duplicate delete snapshots and persistence',()=>{
  const s=setup(),t=sample();s.controller.save(t);t.source='HALT';s.controller.run(['custom']);s.drain();
  assert.deepEqual(s.controller.getSnapshot().results[0].finalState.registers,{A:15,B:0,PC:2,SP:65536});
  s.controller.beginEdit('custom');assert.equal(s.controller.getSnapshot().results.length,0);s.controller.duplicate('custom');assert.equal(s.controller.getSnapshot().custom.length,2);
  s.controller.remove('custom');assert.equal(parseTests(s.raw()).tests.length,1);
});
for(const [name,patch,outcome] of [
  ['mismatch',{assertions:[{target:'register',register:'A',expected:20}]},'FAIL'],
  ['assembly',{source:'MOV 1'},'FAIL'],
  ['unexpected fault',{source:'ldc 65536\nldnl 0'},'FAIL'],
  ['expected fault',{source:'ldc 65536\nldnl 0',expectedAttempts:2,assertions:[],expectedStatus:'error',expectedFaultCode:'C005_INVALID_ADDRESS'},'PASS'],
  ['bounded loop',{source:'br -1',expectedAttempts:300,assertions:[],expectedStatus:'limit-reached',limits:{maxInstructions:300}},'PASS'],
])test(`real panel execution: ${name}`,()=>{const s=setup();s.controller.save({...sample(),...patch});s.controller.run(['custom']);s.drain();const r=s.controller.getSnapshot().results[0];assert.equal(r.outcome,outcome);if(name==='mismatch'){assert.equal(r.assertions.at(-1).expected,20);assert.equal(r.assertions.at(-1).actual,15);}});
test('cancelled suites cannot pass unfinished cases or publish stale callbacks',()=>{
  const s=setup();s.controller.save({...sample(),source:'br -1'});s.controller.run(['custom','halt']);s.tick();const stale=s.callbacks.at(-1);s.controller.cancel();
  assert.equal(s.controller.getSnapshot().cancelled,2);assert.equal(s.controller.getSnapshot().passed,0);s.controller.run(['halt']);stale();assert.equal(s.pending.size,1);s.drain();assert.equal(s.controller.getSnapshot().passed,1);
});
test('dispose prevents execution and notifications, strict lifecycle can reopen',()=>{
  const s=setup();let calls=0;s.controller.subscribe(()=>calls++);s.controller.run(['halt']);const stale=s.callbacks.at(-1);s.controller.dispose();const before=calls;stale();assert.equal(calls,before);assert.equal(s.pending.size,0);assert.equal(s.controller.run(['halt']),false);
  s.controller.initialize(s.storage);assert.equal(s.controller.run(['halt']),true);s.drain();assert.equal(s.controller.getSnapshot().passed,1);
});
test('partial corruption restores valid entries and preserves original until explicit replacement',()=>{
  const raw=JSON.stringify({format:'assembly-emulator-tests',version:1,tests:[sample(),null]});const s=setup(raw);assert.equal(s.controller.getSnapshot().custom.length,1);s.controller.save(sample('second'));assert.equal(s.raw(),raw);assert.equal(s.writes(),0);s.controller.replaceStorage(s.storage);assert.equal(parseTests(s.raw()).tests.length,2);
});
test('restoration retains order and IDs without writes and protects concurrent changes',()=>{
  const s=setup(serializeTests([sample('one'),sample('two')]));assert.equal(s.writes(),0);assert.deepEqual(s.controller.getSnapshot().custom.map(t=>t.id),['one','two']);s.external('newer');s.controller.save(sample('three'));assert.equal(s.raw(),'newer');assert.equal(s.controller.getSnapshot().storage,'protected');
});
test('quota failure preserves definitions in memory',()=>{const s=setup();s.controller.replaceStorage({getItem:()=>null,setItem(){throw Error('quota');}});assert.equal(s.controller.save(sample()),true);assert.equal(s.controller.getSnapshot().storage,'unavailable');assert.equal(parseTests(serializeTests(s.controller.getSnapshot().custom)).tests.length,1);});
test('JSON export import roundtrips and conflicts rename predictably',async()=>{
  const raw=serializeTests([sample()]);const file={name:'tests.json',size:raw.length,arrayBuffer:async()=>new TextEncoder().encode(raw).buffer};const loaded=await readTestFile(file);assert.equal(loaded[0].source,sample().source);
  assert.equal(mergeTests(loaded,loaded,false).renamed,1);assert.equal(mergeTests(loaded,loaded,true).tests.length,1);await assert.rejects(readTestFile({...file,name:'bad.js'}));
});
for(const raw of ['{bad','null','{"version":2,"tests":[]}',JSON.stringify({format:'assembly-emulator-tests',version:1,tests:[sample(),sample()]})])test(`invalid JSON rejected atomically: ${raw.slice(0,25)}`,()=>assert.equal(parseTests(raw).tests.length,0));
for(const value of ['', '1.5','1e3','NaN','123abc','9007199254740993'])test(`numeric input rejects ${JSON.stringify(value)}`,()=>assert.equal(integerField(value),null));
test('fields accept zero and architecture boundaries with source snapshot',()=>{const f=fieldsFor('test','HALT');f.name='Test';f.A='-2147483648';f.B='0';f.PC='65535';f.SP='65536';f.initialMemory='0xffff = 2147483647';const r=validateFields(f,[]);assert.deepEqual(r.errors,{});assert.equal(r.definition.assertions.length,4);assert.equal(r.definition.initialState.memory[0].address,65535);});
for(const [key,value] of [['name',''],['source','MOV 1'],['budget','0'],['attempts','-1'],['status','paused'],['memory','0=0\n0=1'],['initialMemory','65536=1'],['A','2147483648']])test(`form rejects invalid ${key}`,()=>{const f=fieldsFor('test','HALT');f.name='Test';f[key]=value;assert.equal(validateFields(f,[]).definition,null);});
test('duplicate custom names and missing fault codes have specific errors',()=>{const f=fieldsFor('other','HALT');f.name='CUSTOM';f.status='error';const r=validateFields(f,[sample()]);assert.ok(r.errors.name);assert.ok(r.errors.fault);});
test('private test suite cannot change active debugger state or timer',()=>{const live=setup();const cpu=createWorkspaceController(live.clock);cpu.setSource('ldc 10\nadc 5\nHALT');cpu.assemble();cpu.toggleBreakpoint(3);cpu.run();const before=structuredClone(cpu.getSnapshot());const tests=setup();tests.controller.run(PREDEFINED_TEST_CASES.map(t=>t.id));tests.drain();assert.deepEqual(cpu.getSnapshot(),before);assert.equal(live.pending.size,1);live.tick();assert.equal(cpu.getSnapshot().cpu.registers.A,15);});
