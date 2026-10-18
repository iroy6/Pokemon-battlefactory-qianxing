// Gen IX behavior fixtures. Sources and legacy policy: docs/modern-rules.md.
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../../src/game/engine.js'),D=require('../../src/data/species-data.js'),M=require('../../src/data/meta.js');
function mon(ability='Torrent',patch={}){return Object.assign(E.createMon(D.sets.find(s=>s.num===7)),{ability,abilityZh:ability,item:'Stick',itemActive:false,types:['Normal']},patch)}
function battle(a='Torrent',b='Pressure'){const g=new E.Battle([mon(a),mon()],[mon(b),mon()],217);g.rng.chance=(n,d=100)=>d===100&&n>0;return g}
function use(g,key,s=0){const m=g.mon(s);if(!m.moves.some(x=>x.id===key))m.moves.push({id:key,pp:M.moves[key].pp,maxpp:M.moves[key].pp});g.use(s,key);return m.moves.find(x=>x.id===key)}
const activations=(g,side)=>g.events.filter(e=>e.kind==='ability'&&e.side===side);
test('Pressure announces on entry and re-entry, never when deducting PP',()=>{
 const g=battle();assert.equal(activations(g,1).length,1);assert.match(activations(g,1)[0].text,/施加了压迫感/);
 const slot=use(g,'watergun');assert.equal(slot.pp,slot.maxpp-2);use(g,'watergun');assert.equal(activations(g,1).length,1);
 g.switch(1,1);g.switch(1,0);assert.equal(activations(g,1).length,2);
});
test('Pressure target scope: weather, sports and foe hazards, not own buffs, screens or Assist',()=>{
 for(const [key,cost] of [['raindance',2],['sunnyday',2],['sandstorm',2],['electricterrain',2],['watersport',2],['mudsport',2],['stealthrock',2],['swordsdance',1],['reflect',1],['safeguard',1],['assist',1]]){
  const g=battle(),slot=use(g,key);assert.equal(slot.maxpp-slot.pp,cost,key);assert.equal(activations(g,1).length,1,key);
 }
});
test('Pressure still deducts on miss, Protect and type immunity, and never below zero',()=>{
 for(const mode of ['miss','protect','immune']){const g=battle();if(mode==='miss')g.rng.chance=()=>false;if(mode==='protect')g.mon(1).vol.protect=true;if(mode==='immune')g.mon(1).types=['Ghost'];const slot=use(g,'scratch');assert.equal(slot.pp,slot.maxpp-2,mode);slot.pp=1;g.use(0,'scratch');assert.equal(slot.pp,0);assert.equal(activations(g,1).length,1)}
});
test('Pressure charges Dig once and does not charge a called move a second time',()=>{
 const g=battle(),slot=use(g,'dig');g.use(0,'dig');assert.equal(slot.maxpp-slot.pp,2);assert.equal(activations(g,1).length,1);
 const h=battle();h.mon(0).moves.push({id:'watergun',pp:10,maxpp:25});h.use(0,'watergun',true);assert.equal(h.mon(0).moves.at(-1).pp,10);
});
test('Volt Absorb intercepts Thunder Wave and heals one quarter, even at full HP it blocks status',()=>{
 const g=battle('Torrent','Volt Absorb'),m=g.mon(1);m.hp=1;use(g,'thunderwave');assert.equal(m.hp,1+Math.floor(m.maxhp/4));assert.equal(m.status,'');assert.equal(activations(g,1).length,1);
 m.hp=m.maxhp;use(g,'thunderwave');assert.equal(m.status,'');assert.equal(m.hp,m.maxhp);assert.equal(g.events.filter(e=>e.kind==='heal').length,1);
});
test('Protect prevents Flash Fire, Volt Absorb and Motor Drive activation',()=>{
 for(const [ability,key] of [['Flash Fire','willowisp'],['Volt Absorb','thunderwave'],['Motor Drive','thunderwave']]){const g=battle('Torrent',ability);g.mon(1).vol.protect=true;g.mon(1).hp=10;use(g,key);assert.equal(activations(g,1).length,0);assert.equal(g.mon(1).hp,10);assert.equal(g.mon(1).boosts.spe,0)}
});
test('Flash Fire also absorbs Fire moves while frozen, without thawing',()=>{
 const g=battle('Torrent','Flash Fire');g.mon(1).status='frz';use(g,'willowisp');assert.equal(g.mon(1).status,'frz');assert.equal(g.mon(1).vol.flashfire,true);assert.equal(activations(g,1).length,1);
 const h=battle('Torrent','Flash Fire');h.mon(1).status='frz';h.rng.chance=(n,d=100)=>d===100&&n>=80;use(h,'ember');assert.equal(h.mon(1).hp,h.mon(1).maxhp);assert.equal(h.mon(1).status,'frz');assert.equal(h.mon(1).vol.flashfire,true);
 const j=battle('Torrent','Flash Fire');use(j,'willowisp');assert.equal(j.mon(1).vol.flashfire,true);assert.equal(j.mon(1).status,'');
});
test('Contact abilities announce only successful statuses, not existing status or type immunity',()=>{
 for(const [ability,status,types] of [['Static','brn',['Normal']],['Flame Body','',['Fire']],['Poison Point','',['Steel']],['Effect Spore','par',['Normal']]]){const g=battle('Torrent',ability);Object.assign(g.mon(0),{status,types});g.contact(0,1);assert.equal(g.mon(0).status,status);assert.equal(activations(g,1).length,0,ability)}
 const g=battle('Torrent','Static');g.contact(0,1);assert.equal(g.mon(0).status,'par');assert.equal(activations(g,1).length,1);assert.deepEqual(g.events.slice(-2).map(e=>e.kind),['ability','status']);g.contact(0,1);assert.equal(activations(g,1).length,1);
});
test('Contact still works from a defender just knocked out, but never affects a fainted attacker',()=>{
 const g=battle('Torrent','Static');g.mon(1).hp=0;g.contact(0,1);assert.equal(g.mon(0).status,'par');
 const h=battle('Torrent','Static');h.mon(0).hp=0;h.contact(0,1);assert.equal(activations(h,1).length,0);
});
test('Contact classification: Double Slap, Grass Knot and Avalanche contact; Twineedle does not',()=>{
 for(const key of ['doubleslap','grassknot','avalanche','twineedle']){const g=battle('Torrent','Static');g.mon(1).hp=g.mon(1).maxhp=10000;use(g,key);assert.equal(g.mon(0).status,key==='twineedle'?'':'par',key)}
});
test('Magic Guard prevents residual damage silently; confusion and Struggle still damage',()=>{
 const g=battle('Magic Guard','Torrent');g.mon(0).status='tox';g.weather='sandstorm';g.weatherLeft=-1;g.residual();assert.equal(g.mon(0).hp,g.mon(0).maxhp);assert.equal(g.mon(0).revealedAbility,false);assert.equal(activations(g,0).length,0);
 const hp=g.mon(0).hp;g.damage(0,5,'混乱自伤',false);g.damage(0,5,'挣扎反作用',false);assert.equal(g.mon(0).hp,hp-10);
});
test('Natural Cure clears status on living switch-out with one recovery announcement',()=>{
 const g=battle('Natural Cure','Torrent'),old=g.mon(0);old.status='tox';old.toxic=4;g.switch(0,1);assert.equal(old.status,'');assert.equal(old.toxic,0);assert.equal(old.revealedAbility,true);assert.equal(activations(g,0).length,1);
 const h=battle('Natural Cure','Torrent');h.mon(0).status='brn';h.mon(0).hp=0;h.switch(0,1,true);assert.equal(h.sides[0].team[0].status,'brn');
});
test('Synchronize announces only a successful reflection, preserves toxic and cannot recurse',()=>{
 const g=battle('Synchronize','Synchronize');g.setStatus(1,'tox',0);assert.equal(g.mon(0).status,'tox');assert.equal(g.mon(1).status,'tox');assert.equal(activations(g,1).length,1);assert.equal(activations(g,0).length,0);
 const h=battle('Torrent','Synchronize');h.mon(0).types=['Steel'];h.setStatus(1,'tox',0);assert.equal(h.mon(0).status,'');assert.equal(activations(h,1).length,0);
});
test('Prevented secondary status and flinch do not generate failed-activation popups',()=>{
 const g=battle('Torrent','Inner Focus');use(g,'headbutt');assert.equal(g.mon(1).vol.flinch,undefined);assert.equal(activations(g,1).length,0);
 const h=battle('Torrent','Water Veil');h.mon(1).hp=h.mon(1).maxhp=1000;use(h,'ember');assert.equal(h.mon(1).status,'');assert.equal(activations(h,1).length,0);
 const j=battle('Torrent','Water Veil');use(j,'willowisp');assert.equal(activations(j,1).length,1);assert.equal(j.events.filter(e=>e.kind==='fail').length,0);
});
test('Serene Grace doubles native flinch, King Rock / Razor Fang do not stack',()=>{
 for(const item of ['Kings Rock','Razor Fang']){const g=battle('Serene Grace','Torrent');Object.assign(g.mon(0),{item,itemActive:true});g.mon(1).hp=g.mon(1).maxhp=10000;const chances=[];g.rng.chance=(n,d=100)=>{if(d===100)chances.push(n);return n>=80&&d===100};use(g,'thunderfang');assert.deepEqual(chances,[95,20,20],item)}
});
test('Safeguard stops status moves but not contact abilities',()=>{
 const g=battle('Torrent','Static');g.sides[0].conditions.safeguard=5;g.contact(0,1);assert.equal(g.mon(0).status,'par');assert.equal(activations(g,1).length,1);
 const h=battle('Torrent','Torrent');h.sides[1].conditions.safeguard=5;use(h,'toxic');assert.equal(h.mon(1).status,'');assert.equal(h.events.filter(e=>e.kind==='blocked').length,1);
});
test('Safeguard blocks Yawn initially, but cannot stop sleep after drowsiness starts',()=>{
 const g=battle('Torrent','Torrent');g.sides[1].conditions.safeguard=5;use(g,'yawn');assert.equal(g.mon(1).vol.yawn,undefined);
 const h=battle('Torrent','Torrent');use(h,'yawn');h.sides[1].conditions.safeguard=5;h.residual();h.residual();assert.equal(h.mon(1).status,'slp');
});
test('Failed secondary confusion is silent; direct Confuse Ray explains Own Tempo once',()=>{
 const g=battle('Torrent','Own Tempo');use(g,'confusion');assert.equal(g.mon(1).vol.confusion,undefined);assert.equal(activations(g,1).length,0);
 const h=battle('Torrent','Own Tempo');use(h,'confuseray');assert.equal(activations(h,1).length,1);assert.equal(h.events.filter(e=>e.kind==='fail').length,0);
});
