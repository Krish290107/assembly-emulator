import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import { runTestCase } from '../src/lib/testing/index.ts';
const require=createRequire(import.meta.url);
function component(file,extra={}) {
  const source=readFileSync(new URL(file,import.meta.url),'utf8');
  const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const resolved=output.replace(/from (["'])([^"']+)\1/g,(_,q,s)=>`from ${JSON.stringify(extra[s] ?? (s.startsWith('@/') ? new URL(`../src/${s.slice(2)}.ts`,import.meta.url).href : pathToFileURL(require.resolve(s)).href))}`);
  return `data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`;
}
const form=component('../src/components/panels/test-case-form.tsx');
const {TestCaseForm}=await import(form);
const {TestCasesContent,TestResultDetails}=await import(component('../src/components/panels/test-cases-content.tsx',{'./test-case-form':form}));
test('panel renders fourteen real fixture controls, loading state, and accessible section navigation targets',()=>{
  const html=renderToStaticMarkup(createElement(TestCasesContent,{source:'HALT'}));
  assert.match(html,/id="tests-predefined"/);assert.match(html,/id="tests-custom"/);assert.match(html,/Loading custom tests/);assert.equal((html.match(/aria-label="Run /g)||[]).length,14);assert.match(html,/Run all predefined \(14\)/);assert.match(html,/Import mode/);
});
test('custom form uses native submission, explicit optional fields, source snapshot and escaped text',()=>{
  const html=renderToStaticMarkup(createElement(TestCaseForm,{id:'one',source:'; <script>\nHALT',existing:[],onSave:()=>true,onClose(){}}));
  assert.match(html,/<form/);assert.match(html,/type="submit"/);assert.match(html,/Expected A \(optional\)/);assert.match(html,/Initial memory/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script>/);
});
test('test form and import controls expose browser-identifiable fields in addition to accessible labels',()=>{
  const formHtml=renderToStaticMarkup(createElement(TestCaseForm,{id:'named',source:'HALT',test:{id:'named',name:'Named',source:'HALT',assertions:[],expectedStatus:'error',expectedFaultCode:'C005_INVALID_ADDRESS'},existing:[],onSave:()=>true,onClose(){}}));
  const panelHtml=renderToStaticMarkup(createElement(TestCasesContent,{source:'HALT'}));
  for(const html of [formHtml,panelHtml]) for(const tag of html.match(/<(?:input|select|textarea)\b[^>]*>/g)??[]) assert.match(tag,/\b(?:id|name)="[^"]+"/);
});
test('result component renders real expected 20 actual 15 FAIL without fabricated successful state',async()=>{
  const result=await runTestCase({id:'one',name:'Addition',source:'ldc 10\nadc 5\nHALT',assertions:[{target:'register',register:'A',expected:20}]});
  const html=renderToStaticMarkup(createElement(TestResultDetails,{result}));
  assert.match(html,/<td>20<\/td><td>15<\/td><td>FAIL<\/td>/);assert.match(html,/3 attempts/);assert.match(html,/halted/);
});
test('large real assertion results render at most 100 rows without dropping stored outcomes',async()=>{
  const result=await runTestCase({id:'large',name:'Large',source:'HALT',assertions:Array.from({length:1000},(_,i)=>({target:'memory',address:i+1,expected:1}))});
  const html=renderToStaticMarkup(createElement(TestResultDetails,{result}));
  assert.equal((html.match(/<tr>/g)||[]).length,101);
  assert.match(html,/Next assertions/);assert.match(html,/1001/);assert.match(html,/Next failure reasons/);
  assert.equal(result.assertions.length,1001);assert.equal(result.failureReasons.length,1000);assert.equal(result.assertions.at(-1).actual,0);
});
