import assert from 'node:assert/strict';
import { test } from 'node:test';
import { navigatePanelSection } from '../src/lib/editor/panel-navigation.ts';
test('section navigation focuses without ancestor scroll and moves only the drawer content',()=>{
  const moves=[],focus=[];
  const content={scrollTop:350,getBoundingClientRect:()=>({top:150}),scrollTo:options=>moves.push(options)};
  const heading={focus:options=>focus.push(options),getBoundingClientRect:()=>({top:780}),scrollIntoView(){throw Error('Would scroll dialog ancestors');}};
  navigatePanelSection(heading,content);
  assert.deepEqual(focus,[{preventScroll:true}]);assert.deepEqual(moves,[{top:980,behavior:'instant'}]);
  heading.getBoundingClientRect=()=>({top:0});navigatePanelSection(heading,content);assert.equal(moves[1].top,200);
});
test('missing section/content cannot throw or navigate the workbench',()=>{navigatePanelSection(null,null);navigatePanelSection({focus(){throw Error();},getBoundingClientRect:()=>({top:0})},null);});
