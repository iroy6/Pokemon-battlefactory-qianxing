// Exercise real swap commands and rendered text from an unobserved defeated team.
// Fixture setup is injected into an in-memory save, never the shipped Lua source.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {createStudio} from '../simulator/dist/studio.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const setup=`
 local originalText=G.text
 G.text=function(self,text,...) print('swap-text',tostring(text));return originalText(self,text,...) end
 state=F.new(E.Factory,217,1)
 for i=0,2 do assert(call(state,'select',i)) end
 assert(call(state,'lock'));assert(call(state,'begin'))
 for i=0,2 do state.battle.sides[1].team[i].hp=0 end
 assert(call(state,'act',F.obj({kind='move',index=0})).ok)
 assert(state.phase=='swap')
 for i=0,2 do local m=state.lastEnemy[i];m.seen=F.arr(0);m.revealedAbility=false;m.revealedItem=false end
 local m=state.lastEnemy[0]
 print('swap-expect',m.abilityZh,m.itemZh,m.natureZh,D.moveNames[m.moves[0].id],D.moveNames[m.moves[1].id],D.moveNames[m.moves[2].id],D.moveNames[m.moves[3].id])
`;
for(const runtime of ['simulator','qianxing']){
 let save=JSON.parse(fs.readFileSync(path.join(root,runtime,'battle-factory.save.json'),'utf8'));
 const app=save.assets.scripts.find(s=>s.path.endsWith('/battle_factory_app.lua'));
 const source=app.source||fs.readFileSync(path.join(root,app.path),'utf8');
 const startState=/^ state=newChallenge\(\)\r?$/m;
 assert.ok(startState.test(source));
 app.source=source.replace(startState,setup);
 delete save.scriptSync;
 if(runtime==='simulator')for(const script of save.assets.scripts){
  script.source=(script.source||fs.readFileSync(path.join(root,script.path),'utf8')).replaceAll('simulator/lua/','workspace/swap-verification/lua/');
  script.path=script.path.replace('simulator/lua/','workspace/swap-verification/lua/');
 }
 if(runtime==='simulator')save=JSON.parse(JSON.stringify(save).replaceAll('simulator/lua/','workspace/swap-verification/lua/'));
 if(process.argv.includes('--preview-fixture')){
  fs.mkdirSync(path.join(root,'.local'),{recursive:true});fs.writeFileSync(path.join(root,`.local/swap-${runtime}.save.json`),JSON.stringify(save));
 }
 const studio=createStudio(save,{workspacePath:root});
 try{
  studio.playStart({canvasId:'mobile-16-9'});
  const get=()=>{const state=studio.playGet({compact:true});assert.ok(!state.mountError,state.mountError);assert.deepEqual(state.logs.filter(l=>l.level==='error'),[]);return state};
  const expected=get().logs.find(l=>l.text.startsWith('swap-expect')).text.split('\t').slice(1);
  const click=name=>{assert.notEqual(studio.playClick(name)?.clicked,false,name);get()};
  click('action-swap-own-0');click('action-swap-foe-0');click('action-swap-info');
  const rendered=()=>get().logs.filter(l=>l.text.startsWith('swap-text')).map(l=>l.text.slice(10)).join('\n');
  assert.ok(rendered().includes(expected[0]));assert.ok(rendered().includes(expected[2]));
  click('action-summary-page-1');assert.ok(rendered().includes(expected[1]));
  click('action-summary-page-2');for(const move of expected.slice(3))assert.ok(rendered().includes(move),move);
  assert.ok(rendered().includes('PP '));assert.doesNotMatch(rendered(),/未确认|未公开|尚未观察到|已观察/);
  console.log(runtime,'unobserved opponent: ability/item/nature/all four moves/PP visible');
 }finally{studio.playStop()}
}
