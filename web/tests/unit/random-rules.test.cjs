const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../../src/game/engine.js'),D=require('../../src/data/species-data.js'),M=require('../../src/data/meta.js');
const mon=()=>E.createMon({...D.sets.find(s=>s.num===7),item:'Stick',ability:'Torrent'});
const battle=seed=>new E.Battle([mon(),mon()],[mon(),mon()],seed);

test('RNG half-open integers, probability boundaries and replay are stable',()=>{
 const a=new E.RNG(12345),b=new E.RNG(12345),seen=[];
 for(let i=0;i<2000;i++){const n=a.int(85,101);assert.equal(n,b.int(85,101));assert.ok(n>=85&&n<=100);if(!seen.includes(n))seen.push(n);}
 assert.equal(seen.length,16);assert.equal(a.chance(0),false);assert.equal(a.chance(100),true);
});
test('equal-speed entry order is randomized, not always player first',()=>{
 const first=[];for(let i=0;i<40;i++){const b=battle(i*7919+1);first.push(b.events.find(e=>e.kind==='switch').side);}
 assert.ok(first.includes(0));assert.ok(first.includes(1));
});
test('equal-speed poison residual can resolve in either order',()=>{
 for(const roll of [false,true]){const b=battle(123);b.mon(0).status='psn';b.mon(1).status='psn';b.rng.chance=()=>roll;b.events=[];b.residual();const damage=b.events.filter(e=>e.kind==='damage');assert.equal(damage.length,2);assert.equal(damage[0].side,roll?1:0);}
});
test('confusion self-hit uses the Gen IV 85-100 damage roll',()=>{
 const damages=[];for(const roll of [85,100]){const b=battle(123);b.mon(0).vol.confusion=3;b.rng.chance=()=>true;b.rng.int=(lo,hi)=>{assert.equal(lo,85);assert.equal(hi,101);return roll;};const hp=b.mon(0).hp;assert.equal(b.beforeMove(0,M.moves.watergun),false);damages.push(hp-b.mon(0).hp);}
 assert.ok(damages[0]<damages[1]);
});
test('equal-priority speed ties can put either side first',()=>{
 for(const roll of [false,true]){const b=battle(123);for(const s of [0,1])b.mon(s).moves=[{id:'withdraw',pp:40,maxpp:40}];b.enemyChoice={kind:'move',index:0};b.rng.chance=()=>roll;const r=b.act({kind:'move',index:0});assert.ok(r.ok);assert.equal(r.events.find(e=>e.kind==='move').side,roll?1:0);}
});
test('Life Orb applies after the Gen IV critical modifier before damage roll',()=>{
 const b=battle(123);b.mon(0).item='Life Orb';b.mon(0).stats.atk=100;b.mon(1).stats.def=100;
 // floor(22*40*100/100/50)+2 = 19; critical 38; Life Orb floor(49.4)=49.
 assert.equal(b.calculate(0,M.moves.scratch,{critical:true}),49);
});
test('Gen IV normal recoil floors the damage fraction',()=>{
 const b=battle(123);b.mon(0).moves=[{id:'takedown',pp:20,maxpp:20}];b.calculate=()=>7;b.rng.chance=(n,d=100)=>d===100;
 const hp=b.mon(0).hp;b.use(0,'takedown');assert.equal(hp-b.mon(0).hp,1);
});
test('sleep advances before flinch; confusion advances before paralysis',()=>{
 const b=battle(123),a=b.mon(0);a.status='slp';a.sleep=2;a.vol.flinch=true;b.beforeMove(0,M.moves.watergun);assert.equal(a.sleep,1);
 delete a.vol.flinch;a.status='par';a.vol.confusion=3;b.rng.chance=n=>n===25;assert.equal(b.beforeMove(0,M.moves.watergun),false);assert.equal(a.vol.confusion,2);
});
test('Shed Skin cures sleep before Bad Dreams can damage the sleeper',()=>{
 const b=battle(123);b.mon(0).ability='Shed Skin';b.mon(0).status='slp';b.mon(1).ability='Bad Dreams';b.rng.chance=()=>true;
 const hp=b.mon(0).hp;b.residual();assert.equal(b.mon(0).status,'');assert.equal(b.mon(0).hp,hp);
});
test('a challenge is not silently lost on turn 501',()=>{
 const b=battle(123);b.turn=500;for(const s of [0,1])b.mon(s).moves=[{id:'withdraw',pp:40,maxpp:40}];b.enemyChoice={kind:'move',index:0};b.act({kind:'move',index:0});assert.equal(b.turn,501);assert.equal(b.phase,'battle');
});
test('inspection and invalid inputs do not change the committed AI or battle RNG',()=>{
 const b=battle(317),seed=b.rng.seed,ai=b.aiRng.seed,enemy=JSON.stringify(b.enemyChoice);
 for(let i=0;i<20;i++){b.usable(0);b.calculate(0,M.moves.watergun);b.effectiveness('Water',b.mon(1));}
 assert.equal(b.act({kind:'move',index:99}).ok,false);assert.equal(b.rng.seed,seed);assert.equal(b.aiRng.seed,ai);assert.equal(JSON.stringify(b.enemyChoice),enemy);
});
test('Hydration resolves in the weather phase before Black Sludge damage',()=>{
 const b=battle(123),a=b.mon(0);a.ability='Hydration';a.status='slp';a.sleep=3;a.item='Black Sludge';a.hp=1;b.weather='rain';b.weatherLeft=3;
 b.events=[];b.residual();assert.equal(a.status,'');assert.ok(b.events.findIndex(e=>e.kind==='cure')<b.events.findIndex(e=>e.kind==='damage'));
});
test('residual defeat stops later damage instead of manufacturing a double knockout',()=>{
 const b=new E.Battle([mon()],[mon()],123);b.mon(0).hp=1;b.mon(1).hp=1;b.mon(0).status='psn';b.mon(1).status='psn';b.mon(0).stats.spe=10;b.mon(1).stats.spe=20;
 b.residual();assert.equal(b.phase,'win');assert.equal(b.mon(0).hp,1);assert.equal(b.mon(1).hp,0);
});
test('Disable blocks before confusion advances or can cause self damage',()=>{
 const b=battle(123),a=b.mon(0);a.vol.disable={id:'watergun',left:3};a.vol.confusion=3;b.rng.chance=()=>true;const hp=a.hp;
 assert.equal(b.beforeMove(0,M.moves.watergun),false);assert.equal(a.vol.confusion,3);assert.equal(a.hp,hp);
});
test('an attempted move counts as acted even if sleep prevents execution',()=>{
 const b=battle(123),a=b.mon(0);a.status='slp';a.sleep=3;b.use(0,'watergun');assert.equal(a.vol.moved,true);
 b.mon(1).moves=[{id:'protect',pp:10,maxpp:10}];b.rng.chance=()=>true;b.use(1,'protect');assert.equal(!!b.mon(1).vol.protect,false);
});
