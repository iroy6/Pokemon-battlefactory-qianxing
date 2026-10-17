const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../../src/game/engine.js'),D=require('../../src/data/species-data.js'),M=require('../../src/data/meta.js');
const mon=n=>E.createMon(D.sets.find(s=>s.num===n));
const fight=(a,b)=>new E.Battle(a.map(mon),b.map(mon),217);
const prepare=seed=>{const f=new E.Factory(seed);[0,1,2].forEach(i=>f.select(i));f.lock();f.begin();return f};
test('Gen IV metadata: historical stats, types, priority and power',()=>{
 assert.equal(M.species.pikachu.baseStats.def,30);assert.equal(M.species.pikachu.baseStats.spd,40);
 assert.deepEqual(M.species.clefairy.types,['Normal']);assert.equal(M.chart.Ghost.Steel,.5);
 assert.equal(M.moves.protect.priority,3);assert.equal(M.moves.fakeout.priority,1);
 assert.equal(M.moves.knockoff.power,20);assert.equal(M.moves.rocktomb.accuracy,80);
 assert.equal(M.moves.toxic.accuracy,85);assert.equal(M.moves.willowisp.accuracy,75);
 // Equal IV 31 in custom divisions; 252 EV -> 63 points before the level multiplier.
 assert.deepEqual(mon(25).stats,{hp:110,atk:67,def:50,spa:112,spd:60,spe:142});
});
test('rental selection: exactly three, ordering and unique species/items',()=>{
 const f=new E.Factory(48);assert.equal(f.lock(),false);f.select(0);f.select(1);assert.equal(f.lock(),false);
 f.select(2);assert.equal(f.select(3),false);f.select(1);f.select(4);assert.deepEqual(f.selected,[0,2,4]);
 assert.ok(f.lock());assert.deepEqual(f.team.map(m=>m.key),[0,2,4].map(i=>f.candidates[i].key));
 for(const group of [f.candidates,...f.opponents]){assert.equal(new Set(group.map(m=>m.num)).size,group.length);assert.equal(new Set(group.map(m=>m.item)).size,group.length)}
});
test('damage fixture: no random crit, STAB and 4x weakness',()=>{
 const b=fight([17],[1]);const m=M.moves.wingattack;
 // IV31: Pidgeotto Atk123 / Bulbasaur Def69 -> base49, STAB73, effectiveness2 ->146.
 assert.equal(b.mon(0).stats.atk,123);assert.equal(b.mon(1).stats.def,69);
 assert.equal(b.calculate(0,m,{roll:100}),146);
 assert.equal(b.effectiveness('Ground',mon(81)),4);assert.equal(b.effectiveness('Normal',mon(93)),0);
});
test('invalid action/zero PP does not consume turn or RNG',()=>{
 const b=fight([25,7],[1,4]);b.mon(0).moves[0].pp=0;const seed=b.rng.seed,turn=b.turn;
 assert.equal(b.act({kind:'move',index:0}).ok,false);assert.equal(b.rng.seed,seed);assert.equal(b.turn,turn);
 assert.equal(b.act({kind:'switch',index:0}).ok,false);assert.equal(b.actions.length,0);
});
test('priority: Aqua Jet precedes faster ordinary move',()=>{
 const b=fight([7],[100]);b.enemyChoice={kind:'move',index:0};const r=b.act({kind:'move',index:0});
 assert.equal(r.events.find(e=>e.kind==='move').side,0);assert.equal(b.mon(0).moves[0].pp,19);
});
test('status immunity, cure berry, Gen IV electric paralysis and Magic Guard',()=>{
 let b=fight([25],[4]);assert.ok(b.setStatus(0,'par'));assert.equal(b.speed(0),35);
 b=fight([54],[4]);assert.ok(b.setStatus(0,'slp'));assert.equal(b.mon(0).status,'');assert.equal(b.mon(0).itemActive,false);
 b=fight([35],[4]);b.setStatus(0,'tox');b.residual();assert.equal(b.mon(0).hp,b.mon(0).maxhp);
 b=fight([88],[4]);assert.equal(b.setStatus(0,'tox'),false);
});
test('Water Absorb heals, Levitate blocks Ground, Ghost blocks Normal',()=>{
 let b=fight([54],[61]);b.mon(1).hp-=40;const before=b.mon(1).hp;b.use(0,'watergun');assert.ok(b.mon(1).hp>before);
 b=fight([74],[93]);b.use(0,'magnitude');assert.equal(b.mon(1).hp,b.mon(1).maxhp);
 b=fight([47],[93]);b.use(0,'scratch');assert.equal(b.mon(1).hp,b.mon(1).maxhp);
});
test('Leech Seed from side zero cannot be reapplied and drains',()=>{
 const b=fight([1],[98]);b.rng.chance=()=>true;b.use(0,'leechseed');assert.equal(b.mon(1).vol.seed,0);
 b.use(0,'leechseed');assert.equal(b.events.at(-1).kind,'fail');b.mon(0).hp-=30;const hp=b.mon(1).hp;b.residual();assert.ok(b.mon(1).hp<hp);assert.ok(b.mon(0).hp>b.mon(0).maxhp-30);
});
test('Dig charges once, consumes one PP, Magnitude can hit underground',()=>{
 const b=fight([27],[74]);b.use(0,'dig');assert.ok(b.mon(0).vol.dig);assert.equal(b.mon(0).moves[0].pp,9);
 assert.equal(b.usable(0)[0].maxpp,10);assert.ok(b.hitCheck(1,M.moves.magnitude));assert.equal(b.hitCheck(1,M.moves.strength),false);
 b.use(0,'dig');assert.equal(b.mon(0).vol.dig,undefined);assert.equal(b.mon(0).moves[0].pp,9);
});
test('Assist called Dig can complete even without a Dig move slot',()=>{
 const b=fight([96,27],[7]);b.mon(0).lastMove='assist';b.use(0,'dig',true);
 assert.equal(b.usable(0)[0].index,1);assert.equal(b.usable(0)[0].id,'dig');
 const pp=b.mon(0).moves[1].pp;b.use(0,'assist');assert.equal(b.mon(0).vol.dig,undefined);assert.equal(b.mon(0).moves[1].pp,pp);
});
test('forced replacement does not consume a turn and clears boosts',()=>{
 const b=fight([25,7],[4]);b.mon(0).boosts.atk=3;b.mon(0).hp=0;b.replaceFainted();assert.equal(b.phase,'forced');
 const turn=b.turn;assert.ok(b.act({kind:'switch',index:1}).ok);assert.equal(b.turn,turn);assert.equal(b.sides[0].team[0].boosts.atk,0);assert.equal(b.mon(0).num,7);
});
test('seven victories, restoration, slot-preserving swap, and no eighth match',()=>{
 const f=prepare(92);for(let k=0;k<7;k++){
  const b=f.battle;b.sides[1].team.forEach(m=>{m.hp=0});b.mon(0).hp=10;b.mon(0).status='psn';b.mon(0).itemActive=false;b.mon(0).moves[0].pp=1;
  assert.ok(f.act({kind:'move',index:0}).ok);assert.equal(f.wins,k+1);assert.ok(f.team.every(m=>m.hp===m.maxhp&&!m.status&&m.itemActive&&m.moves.every(x=>x.pp===x.maxpp)));
  if(k<6){assert.equal(f.phase,'swap');const lead=f.team[0].key;
   if(k===0){let found=false;for(let j=0;j<3;j++)if(!f.team.some((m,i)=>i!==1&&(m.num===f.lastEnemy[j].num||m.item===f.lastEnemy[j].item))){const key=f.lastEnemy[j].key;assert.ok(f.exchange(1,j));assert.equal(f.team[1].key,key);found=true;break}assert.ok(found)}else assert.ok(f.exchange());
   assert.equal(f.team[0].key,lead);assert.ok(f.begin());assert.equal(f.battle.sides[0].active,0);
  }
 }assert.equal(f.phase,'win');assert.equal(f.begin(),false);assert.equal(f.exchange(),false);assert.equal(f.history.length,7);
});
test('duplicate exchange rejected; loss ends run',()=>{
 const f=prepare(71);f.phase='swap';f.lastEnemy=f.team.map(x=>structuredClone(x));assert.equal(f.exchange(0,1),false);assert.equal(f.phase,'swap');
 f.phase='battle';f.battle.sides[0].team.forEach(m=>m.hp=0);f.battle.checkResult();f.act({kind:'move',index:0});assert.equal(f.battle.phase,'loss');
 const g=prepare(10);g.battle.sides[0].team.forEach(m=>m.hp=0);g.act({kind:'move',index:0});assert.equal(g.phase,'loss');assert.equal(g.begin(),false);
});
test('every supported move executes without an unsupported handler',()=>{
 for(const move of Object.keys(M.moves)){
  const set={...D.sets[0],moves:[move]};
  const b=new E.Battle([E.createMon(set),mon(7),mon(27)],[mon(98),mon(17),mon(25)],123);
  b.rng.chance=()=>true;b.use(0,move);
  for(const side of b.sides)for(const m of side.team)assert.ok(Number.isFinite(m.hp)&&m.hp>=0&&m.hp<=m.maxhp,move);
 }
});
function simulation(seed){const f=prepare(seed);let actions=0;while(!['win','loss'].includes(f.phase)&&actions<3600){if(f.phase==='intel')f.begin();else if(f.phase==='swap')f.exchange();else{const b=f.battle,action=b.phase==='forced'?{kind:'switch',index:b.switchable(0)[0]}:b.chooseAI(0);assert.ok(f.act(action).ok,JSON.stringify(action));actions++;for(const side of b.sides)for(const m of side.team){assert.ok(Number.isFinite(m.hp)&&m.hp>=0&&m.hp<=m.maxhp);assert.ok(m.moves.every(x=>x.pp>=0&&x.pp<=x.maxpp))}}}assert.ok(['win','loss'].includes(f.phase));return{phase:f.phase,wins:f.wins,actions,history:f.history}}
test('deterministic replay and 100 complete AI challenges without deadlocks',()=>{
 const recorded=simulation(2026);assert.deepEqual(recorded,simulation(2026));
 for(const match of recorded.history){const replay=new E.Battle(match.team,match.enemy,match.seed);for(const input of match.inputs){if(input.enemy)replay.enemyChoice=structuredClone(input.enemy);assert.ok(replay.act(input.player).ok)}assert.equal(replay.phase,match.result);assert.deepEqual(replay.log,match.log)}
 let wins=0,actions=0;for(let i=1;i<=100;i++){const r=simulation(i);wins+=r.phase==='win';actions+=r.actions}console.log('stress:',{challenges:100,sevenWinRuns:wins,actions});
});
