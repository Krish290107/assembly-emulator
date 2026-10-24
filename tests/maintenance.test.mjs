import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSourcePersistence, SourceConflictError, STORAGE_KEY } from '../src/lib/editor/document.ts';
import { fieldsFor, validateFields } from '../src/lib/testing/form.ts';
import { parseTests, serializeTests } from '../src/lib/testing/library.ts';
import { testLibraryPage } from '../src/lib/testing/library-view.ts';
import { runTestCase } from '../src/lib/testing/index.ts';

const draft = code => ({code,filename:'work.asm'});
function savedDraft(initial = null) {
  let raw = initial, writes = 0;
  const storage = {getItem(key){assert.equal(key,STORAGE_KEY);return raw;},setItem(key,value){assert.equal(key,STORAGE_KEY);raw=value;writes++;}};
  return {storage,raw:()=>raw,writes:()=>writes,external(value){raw=value;}};
}
test('two tabs cannot silently overwrite a draft saved after their own restore',()=>{
  const s=savedDraft(JSON.stringify(draft('HALT'))),a=createSourcePersistence(s.storage),b=createSourcePersistence(s.storage);
  a.restore();b.restore();a.save(draft('ldc 10\nHALT'));
  const local=Object.freeze(draft('ldc 20\nHALT'));
  assert.throws(()=>b.save(local),SourceConflictError);
  assert.equal(JSON.parse(s.raw()).code,'ldc 10\nHALT');assert.equal(local.code,'ldc 20\nHALT');assert.equal(s.writes(),1);
});
test('storage notifications protect pending autosave and all subsequent lifecycle flushes',()=>{
  const s=savedDraft(),tab=createSourcePersistence(s.storage);tab.restore();
  s.external(JSON.stringify(draft('other tab')));assert.equal(tab.changed(),true);
  for(const path of ['queued autosave','pagehide','beforeunload','visibilitychange']) assert.throws(()=>tab.save(draft(path)),SourceConflictError);
  assert.equal(s.writes(),0);assert.equal(JSON.parse(s.raw()).code,'other tab');
});
test('delayed foreign-write events still flag a conflict even if current storage matches this tab',()=>{
  const s=savedDraft(),tab=createSourcePersistence(s.storage);tab.restore();tab.save(draft('local'));
  assert.equal(tab.observe(JSON.stringify(draft('foreign write'))),true);
  assert.throws(()=>tab.save(draft('local edit')),SourceConflictError);assert.equal(s.writes(),1);
});
test('deletion, clear and corrupt replacement are external changes even before an event arrives',()=>{
  for(const raw of [null,'{broken',JSON.stringify(draft('newer'))]){
    const s=savedDraft(JSON.stringify(draft('old'))),tab=createSourcePersistence(s.storage);tab.restore();s.external(raw);
    assert.throws(()=>tab.save(draft('local')),SourceConflictError);assert.equal(s.raw(),raw);assert.equal(s.writes(),0);
  }
});
test('corrupt initial storage remains protected through edits and flush attempts',()=>{
  const s=savedDraft('{broken'),tab=createSourcePersistence(s.storage);
  assert.throws(()=>tab.restore());assert.throws(()=>tab.save(draft('edited')),SourceConflictError);assert.equal(s.raw(),'{broken');
  const expected=tab.read();tab.overwrite(draft('explicit recovery'),expected);assert.equal(JSON.parse(s.raw()).code,'explicit recovery');
});
test('explicit overwrite rechecks the exact record captured before confirmation',()=>{
  const s=savedDraft(),tab=createSourcePersistence(s.storage);tab.restore();
  s.external(JSON.stringify(draft('first external')));const expected=tab.read();s.external(JSON.stringify(draft('changed during confirmation')));
  assert.throws(()=>tab.overwrite(draft('local'),expected),SourceConflictError);assert.equal(s.writes(),0);
  tab.overwrite(draft('local'),tab.read());tab.save(draft('next edit'));assert.equal(JSON.parse(s.raw()).code,'next edit');
});
test('reload is read-only, adopts the latest draft baseline and rejects confirmation races',()=>{
  const s=savedDraft(JSON.stringify(draft('old'))),tab=createSourcePersistence(s.storage);tab.restore();
  s.external(JSON.stringify(draft('new')));const expected=tab.read();assert.deepEqual(tab.restore(expected),draft('new'));assert.equal(s.writes(),0);
  tab.save(draft('edited new'));const stale=tab.read();s.external(JSON.stringify(draft('newer')));
  assert.throws(()=>tab.restore(stale),SourceConflictError);assert.equal(s.writes(),1);
});
test('ordinary autosave preserves blank drafts, avoids duplicate writes and retries quota failure',()=>{
  const s=savedDraft(),tab=createSourcePersistence(s.storage);assert.equal(tab.restore(),null);
  tab.save(draft(''));tab.save(draft(''));assert.equal(s.writes(),1);assert.deepEqual(tab.restore(),draft(''));
  let full=true;const flaky=createSourcePersistence({...s.storage,setItem(key,value){if(full)throw Error('quota');s.storage.setItem(key,value);}});flaky.restore();
  assert.throws(()=>flaky.save(draft('keep me')),/quota/);assert.equal(JSON.parse(s.raw()).code,'');full=false;flaky.save(draft('keep me'));assert.equal(JSON.parse(s.raw()).code,'keep me');
});
test('unreadable storage never falls back to an unguarded write',()=>{
  let writes=0;const tab=createSourcePersistence({getItem(){throw Error('denied');},setItem(){writes++;}});
  assert.throws(()=>tab.restore(),/denied/);assert.throws(()=>tab.save(draft('local')),/denied/);assert.equal(writes,0);
});

const imported={id:'initial',name:'Initial values',source:'adc 5\nHALT',assertions:[{target:'register',register:'A',expected:15}],initialState:{registers:{A:10,B:0,PC:0,SP:65536},memory:[{address:100,value:42}]}};
test('imported initial registers roundtrip through editable fields and version-1 JSON',async()=>{
  const incoming=parseTests(serializeTests([imported])).tests[0];const fields=fieldsFor(incoming.id,'unused',incoming);
  assert.deepEqual([fields.initialA,fields.initialB,fields.initialPC,fields.initialSP],['10','0','0','65536']);
  const checked=validateFields(fields,[]);assert.deepEqual(checked.errors,{});
  const restored=parseTests(serializeTests([checked.definition])).tests[0];assert.deepEqual(restored.initialState,incoming.initialState);
  assert.equal((await runTestCase(restored)).outcome,'PASS');
});
test('editing and clearing imported registers never changes expected assertions or retains hidden inputs',async()=>{
  const fields=fieldsFor(imported.id,'',imported);fields.initialA='0';fields.initialB='';fields.initialPC='';fields.initialSP='';
  const checked=validateFields(fields,[]);assert.deepEqual(checked.errors,{});assert.deepEqual(checked.definition.initialState.registers,{A:0});
  const result=await runTestCase(checked.definition);assert.equal(result.outcome,'FAIL');assert.equal(result.assertions.at(-1).expected,15);assert.equal(result.assertions.at(-1).actual,5);
  fields.initialA='';assert.deepEqual(validateFields(fields,[]).definition.initialState.registers,{});
});
test('initial fields accept zero, signed hex and both architecture endpoints',()=>{
  const f=fieldsFor('bounds','HALT');f.name='Bounds';f.initialA='-0x80000000';f.initialB='+0x7fffffff';f.initialPC='0xffff';f.initialSP='65536';
  assert.deepEqual(validateFields(f,[]).definition.initialState.registers,{A:-2147483648,B:2147483647,PC:65535,SP:65536});
  f.initialPC='0';f.initialSP='0';assert.equal(validateFields(f,[]).definition.initialState.registers.SP,0);
});
for(const [key,value] of [['initialA','2147483648'],['initialA','-2147483649'],['initialB','1.5'],['initialPC','65536'],['initialPC','-1'],['initialSP','65537'],['initialSP','-1'],['initialA','1e3']])test(`invalid ${key}=${value} has an associated field error`,()=>{
  const f=fieldsFor('invalid','HALT');f.name='Invalid';f[key]=value;const r=validateFields(f,[]);assert.equal(r.definition,null);assert.ok(r.errors[key]);
});

const library=Array.from({length:100},(_,i)=>({id:`case-${i}`,name:`Case ${i}`,description:i%2?'Odd':'Even',source:'HALT',assertions:[]}));
test('100-case library pages preserve IDs/order without modifying the full suite',()=>{
  const original=structuredClone(library),all=[];
  for(let page=0;page<10;page++){const view=testLibraryPage(library,'',page);assert.equal(view.items.length,10);all.push(...view.items.map(t=>t.id));}
  assert.deepEqual(all,library.map(t=>t.id));assert.deepEqual(library,original);
});
test('search is case-insensitive, preserves declaration order and includes descriptions',()=>{
  const v=testLibraryPage(library,' ODD ',4);assert.equal(v.matched,50);assert.equal(v.items[0].id,'case-81');
  assert.deepEqual(testLibraryPage(library,'case 9').items.map(t=>t.id),['case-9','case-90','case-91','case-92','case-93','case-94','case-95','case-96','case-97','case-98']);
  assert.equal(testLibraryPage(library,'no matches').items.length,0);
});
test('empty/filtered/deleted libraries clamp pages safely at boundaries',()=>{
  for(const [items,query] of [[[],''],[library,'missing'],[library.slice(0,1),'']]){
    const v=testLibraryPage(items,query,99);assert.equal(v.page,0);assert.equal(v.pages,1);assert.ok(v.items.length<=1);
  }
  assert.equal(testLibraryPage(library,'',-1).page,0);assert.equal(testLibraryPage(library,'',Infinity).page,0);
});
