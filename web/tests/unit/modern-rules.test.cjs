const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const E=require('../../src/game/engine.js'),D=require('../../src/data/species-data.js'),M=require('../../src/data/meta.js'),I=require('../../src/data/info.js');
function mon(patch={}){return Object.assign(E.createMon({...D.sets.find(s=>s.num===7),moves:['strength','protect','doublekick','watergun']}),{ability:'',item:'',itemActive:false,types:['Normal']},patch)}
function battle(a={},b={}){const g=new E.Battle([mon(a),mon()],[mon(b),mon()],217);g.rng.chance=(n,d=100)=>d===100&&n>=50;return g}
function use(g,key,s=0){const m=g.mon(s);if(!m.moves.some(x=>x.id===key))m.moves.push({id:key,pp:M.moves[key].pp,maxpp:M.moves[key].pp});g.use(s,key)}
test('modern move numbers, Fairy move typing and Steel matchups',()=>{
 for(const [k,p] of Object.entries({thunderbolt:90,icebeam:90,dracometeor:130,knockoff:65,rapidspin:50,bulletseed:25,drainpunch:75}))assert.equal(M.moves[k].power,p,k);
 assert.equal(M.moves.thunderwave.accuracy,90);assert.equal(M.moves.willowisp.accuracy,85);
 assert.equal(M.moves.protect.priority,4);assert.equal(M.moves.fakeout.priority,3);assert.equal(M.moves.extremespeed.priority,2);
 assert.equal(M.moves.sweetkiss.type,'Fairy');assert.equal(M.chart.Dark.Steel,1);assert.equal(M.chart.Ghost.Steel,1);
});
test('paralysis halves speed, Electric is immune, Magic Guard can be fully paralyzed',()=>{
 const g=battle(),speed=g.speed(0);assert.ok(g.setStatus(0,'par'));assert.equal(g.speed(0),Math.floor(speed/2));
 assert.equal(battle({types:['Electric']}).setStatus(0,'par'),false);
 const h=battle({ability:'Magic Guard',status:'par'});h.rng.chance=()=>true;assert.equal(h.beforeMove(0,M.moves.strength),false);
});
test('burn removes 1/16 HP and Facade bypasses burn damage reduction',()=>{
 const g=battle({hp:160,maxhp:160,status:'brn'});g.residual();assert.equal(g.mon(0).hp,150);
 const h=battle(),plain=h.calculate(0,M.moves.facade);h.mon(0).status='brn';assert.ok(h.calculate(0,M.moves.facade)>plain*1.8);
});
test('confusion uses one-third chance, sleep lasts one to three blocked actions',()=>{
 const g=battle({vol:{confusion:3}}),rolls=[];g.rng.chance=(n,d=100)=>{rolls.push([n,d]);return false};g.beforeMove(0,M.moves.strength);assert.deepEqual(rolls,[[1,3]]);
 const h=battle();h.rng.int=(a,b)=>b-1;h.setStatus(0,'slp');for(let i=0;i<3;i++)assert.equal(h.beforeMove(0,M.moves.strength),false);assert.equal(h.beforeMove(0,M.moves.strength),true);
});
test('critical hits use modern multiplier and 1/24, 1/8, 1/2, guaranteed rates',()=>{
 const g=battle(),normal=g.calculate(0,M.moves.strength);assert.equal(g.calculate(0,M.moves.strength,{critical:true}),Math.floor(normal*1.5));
 for(const [move,item,num,denom] of [['strength','',7,24],['slash','',7,8],['slash','Scope Lens',7,2],['slash','Stick',83,1]]){
  const h=battle({item,itemActive:!!item,num},{hp:10000,maxhp:10000}),rolls=[];h.rng.chance=(n,d=100)=>{if(d!==100)rolls.push([n,d]);return d===100};use(h,move);assert.deepEqual(rolls,[[1,denom]]);
 }
});
test('Sturdy saves full HP from one hit, neither it nor Focus Sash blocks later hits',()=>{
 const g=battle({}, {ability:'Sturdy',hp:10,maxhp:10});use(g,'strength');assert.equal(g.mon(1).hp,1);
 for(const patch of [{ability:'Sturdy'},{item:'Focus Sash',itemActive:true}]){const h=battle({}, {...patch,hp:10,maxhp:10});use(h,'doublekick');assert.equal(h.mon(1).hp,0)}
});
test('Sand Stream expires after five turns',()=>{
 const g=battle({ability:'Sand Stream',types:['Rock']},{types:['Rock']});assert.equal(g.weatherLeft,5);for(let i=0;i<5;i++)g.residual();assert.equal(g.weather,'');
});
test('Inner Focus and Own Tempo stop Intimidate but not ordinary attack drops',()=>{
 for(const ability of ['Inner Focus','Own Tempo']){const g=battle({ability},{ability:'Intimidate'});assert.equal(g.mon(0).boosts.atk,0);use(g,'growl',1);assert.equal(g.mon(0).boosts.atk,-1)}
});
test('Keen Eye ignores evasion boosts and powder fails on Grass',()=>{
 const g=battle({ability:'Keen Eye'});g.mon(1).boosts.evasion=6;let chance;g.rng.chance=n=>{chance=n;return true};g.hitCheck(0,M.moves.watergun);assert.equal(chance,100);
 for(const key of ['sleeppowder','stunspore','poisonpowder','cottonspore']){const h=battle({}, {types:['Grass']});use(h,key);assert.equal(h.mon(1).status,'');assert.equal(h.mon(1).boosts.spe,0,key)}
 const h=battle({types:['Grass']},{ability:'Effect Spore'});h.rng.chance=()=>true;h.contact(0,1);assert.equal(h.mon(0).status,'');
});
test('Protect chains divide by three, Tailwind lasts four turns, boosts use modern levels',()=>{
 const g=battle(),rolls=[];g.rng.chance=(n,d)=>{rolls.push(d);return true};use(g,'protect');use(g,'protect');use(g,'protect');assert.deepEqual(rolls,[1,3,9]);
 use(g,'tailwind');assert.equal(g.sides[0].conditions.tailwind,4);use(g,'minimize');assert.equal(g.mon(0).boosts.evasion,2);delete g.mon(1).vol.protect;use(g,'sweetscent');assert.equal(g.mon(1).boosts.evasion,-2);
});
test('Knock Off gains power against held items, Rapid Spin also boosts speed',()=>{
 const g=battle({}, {item:'Leftovers',itemActive:true}),boosted=g.calculate(0,M.moves.knockoff);g.mon(1).itemActive=false;assert.ok(boosted>g.calculate(0,M.moves.knockoff)*1.4);
 const h=battle();h.mon(0).vol.seed=1;h.sides[0].conditions.stealthrock=-1;use(h,'rapidspin');assert.equal(h.mon(0).boosts.spe,1);assert.equal(h.mon(0).vol.seed,undefined);assert.equal(h.sides[0].conditions.stealthrock,undefined);
});
test('King Rock checks each hit, Serene Grace doubles chance, native flinch does not stack',()=>{
 for(const item of ['Kings Rock','Razor Fang']){const g=battle({item,itemActive:true,ability:'Serene Grace'},{hp:10000,maxhp:10000}),rolls=[];g.rng.chance=(n,d=100)=>{if(d===100)rolls.push(n);return n>=80&&d===100};use(g,'doublekick');assert.deepEqual(rolls,[100,20,20]);rolls.length=0;use(g,'headbutt');assert.deepEqual(rolls,[100,60]);}
});
test('Disable and Encore have fixed action durations including late application',()=>{
 for(const key of ['disable','encore'])for(const moved of [false,true]){const g=battle();g.mon(1).lastMove='strength';g.mon(1).vol.moved=moved;use(g,key);assert.equal(g.mon(1).vol[key].left,(key==='disable'?4:3)+(moved?1:0));}
});
test('sports persist after the user switches, last five turns and reduce power to one-third',()=>{
 const g=battle(),normal=g.calculate(0,M.moves.ember);use(g,'watersport');g.switch(0,1);assert.ok(g.calculate(0,M.moves.ember)<normal/2);for(let i=0;i<5;i++)g.residual();assert.equal(g.calculate(0,M.moves.ember),normal);
});
test('Encore-locked Gigaton Hammer alternates with Struggle, including late Encore',()=>{
 const g=battle({}, {hp:10000,maxhp:10000});use(g,'gigatonhammer');g.mon(0).vol.encore={id:'gigatonhammer',left:3};assert.equal(g.choices(0).length,0);
 g.use(0,'struggle');assert.equal(g.mon(0).lastMove,'struggle');assert.equal(g.choices(0)[0].id,'gigatonhammer');
 const h=battle({}, {hp:10000,maxhp:10000});use(h,'gigatonhammer');h.mon(0).vol.encore={id:'gigatonhammer',left:3};h.use(0,'watergun');assert.equal(h.mon(0).lastMove,'gigatonhammer');
});
test('modern immunity edges: Poison Toxic, Roar through Protect, Ghost switching',()=>{
 const g=battle({types:['Poison']});g.rng.chance=()=>false;g.mon(1).vol.dig={index:0};use(g,'toxic');assert.equal(g.mon(1).status,'tox');
 const h=battle();h.mon(1).vol.protect=true;use(h,'roar');assert.equal(h.sides[1].active,1);
 const j=battle({types:['Steel','Ghost'],vol:{wrap:{source:1}}},{ability:'Magnet Pull'});assert.equal(j.canSwitch(0),true);
});
test('Synchronize preserves toxic but is blocked by Safeguard',()=>{
 const g=battle({}, {ability:'Synchronize'});g.sides[0].conditions.safeguard=5;g.setStatus(1,'tox',0);assert.equal(g.mon(0).status,'');
 const h=battle({}, {ability:'Synchronize'});h.setStatus(1,'tox',0);assert.equal(h.mon(0).status,'tox');
});
test('swap summary shows all pages without any observations',()=>{
 const box={FactoryEngine:E,FactoryData:D,FactoryMeta:M,FactoryInfo:I,FactoryControls:{type:x=>x,category:x=>x},FactoryFX:{source:()=>''},FactoryAtmosphere:{badge:()=>''}};box.window=box;vm.runInNewContext(fs.readFileSync(require.resolve('../../src/ui/views.js'),'utf8'),box);
 const m=mon({ability:'Torrent',abilityZh:'激流',item:'Leftovers',itemZh:'吃剩的东西'});
 const html=[0,1,2].map(page=>box.FactoryViews.summary(m,page,0)).join('');
 for(const value of [m.abilityZh,m.itemZh,m.natureZh,...m.moves.map(x=>E.moveName(x.id))])assert.ok(html.includes(value),value);
 assert.doesNotMatch(html,/未确认|未公开|尚未观察|已观察/);
});
