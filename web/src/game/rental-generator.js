/* Shared HTML / Lua constrained rental generator. No fixed build catalogue. */
(function(root){
'use strict';
const D=root.FactoryData||(typeof require==='function'?require('../data/species-data.js'):null);
const M=root.FactoryMeta||(typeof require==='function'?require('../data/meta.js'):null);
const P=root.FactoryRentalPools||(typeof require==='function'?require('../data/rental-pools.js'):null);
const rules={
 recovery:['recover','roost','moonlight'],
 physicalSetup:['swordsdance','dragondance','howl'],specialSetup:['calmmind','quiverdance'],
 drops:['overheat','leafstorm','dracometeor','superpower'],
 utilityAttacks:['knockoff','rapidspin'],
 drain:['gigadrain','megadrain','drainpunch'],
 weather:{raindance:['swiftswim','hydration'],sunnyday:['chlorophyll','protosynthesis'],sandstorm:['sandveil','sandforce'],electricterrain:['quarkdrive']},
 typeItems:{Normal:'silkscarf',Fire:'charcoal',Water:'mysticwater',Grass:'miracleseed',Electric:'magnet',Ice:'nevermeltice',Fighting:'blackbelt',Poison:'poisonbarb',Ground:'softsand',Flying:'sharpbeak',Psychic:'twistedspoon',Bug:'silverpowder',Rock:'hardstone',Ghost:'spelltag',Dragon:'dragonfang',Dark:'blackglasses',Steel:'metalcoat',Fairy:'fairyfeather'}
};
function power(k){const m=M.moves[k];if(k==='grassknot')return 80;if(k==='magnitude')return 71;if(k==='nightshade')return 55;return m.power*(['bulletseed','rockblast','doubleslap'].includes(k)?3:['doublekick','twineedle'].includes(k)?2:1)}
function accuracy(k){return M.moves[k].accuracy===true?100:M.moves[k].accuracy}
function usefulAttack(k){return power(k)>=40}
function stab(k,spec){return spec.types.includes(M.moves[k].type)&&k!=='nightshade'&&usefulAttack(k)}
function moveScore(k,spec){
 const m=M.moves[k],st=spec.baseStats;
 let value=power(k)*accuracy(k)/100*(k==='nightshade'?1:st[m.category==='Physical'?'atk':'spa']/Math.max(st.atk,st.spa));
 if(stab(k,spec))value+=25;if(m.priority>0)value+=18;if(rules.utilityAttacks.includes(k))value+=35;
 if(rules.drain.includes(k))value+=12;if(['scald','torchsong','psyshock'].includes(k))value+=10;
 if(k==='dig')value-=30;return value;
}
function makePlans(c,lane,spec){
 const plans=[{role:'assault',core:[]}],has=k=>c.support.includes(k),recovery=rules.recovery.filter(has);
 const add=(role,core)=>{if(core.every(has))plans.push({role,core})};
 const boosts=lane.mode==='Physical'?rules.physicalSetup:lane.mode==='Special'?rules.specialSetup:[];
 for(const k of [...boosts,'agility'])if(has(k)){
  if(k==='howl'&&has('swordsdance'))continue;
  if(k==='calmmind'&&has('quiverdance'))continue;
  add('setup',[k]);for(const heal of recovery)add('setup',[k,heal]);
 }
 for(const heal of recovery)add('bulky',[heal]);
 for(const k of ['stealthrock','thunderwave','willowisp','sleeppowder','toxic','leechseed','encore','yawn','tailwind'])if(has(k)){
  if(k==='tailwind'&&spec.baseStats.spe<45)continue;
  add('utility',[k]);for(const heal of recovery)add('bulky',[k,heal]);
  if(['toxic','leechseed','yawn'].includes(k))add('bulky',[k,'protect']);
 }
 if(has('stealthrock'))for(const k of ['roar','whirlwind'])add('utility',['stealthrock',k]);
 // Two complementary support slots also suit species with limited coverage.
 // Never stack two major status inflictors or two competing setup moves.
 for(const first of ['stealthrock','leechseed','encore','reflect','lightscreen'])if(has(first)){
  for(const second of ['toxic','thunderwave','willowisp','sleeppowder','yawn'])add('utility',[first,second]);
 }
 add('screens',['reflect','lightscreen']);
 for(const k of ['reflect','lightscreen'])for(const heal of recovery)add('bulky',[k,heal]);
 for(const k of ['raindance','sunnyday','sandstorm','electricterrain'])if(has(k)){
  if(c.abilities.every(a=>a==='sandstream'))continue;
  const benefit=c.abilities.some(a=>rules.weather[k].includes(a)) ||
   (k==='raindance'&&spec.types.includes('Water')) || (k==='sunnyday'&&spec.types.includes('Fire')) ||
   (k==='sandstorm'&&spec.types.includes('Rock')) || (k==='electricterrain'&&spec.types.includes('Electric'));
  if(!benefit)continue;
  if(k==='sandstorm'&&!spec.types.some(t=>['Rock','Ground','Steel'].includes(t))&&!c.abilities.some(a=>['sandveil','sandforce','magicguard'].includes(a)))continue;
  if(k==='electricterrain'&&(spec.types.includes('Flying')||c.abilities.every(a=>a==='levitate')))continue;
  add('weather',[k]);
 }
 return plans;
}
function allowedAttack(k,plan){
 if(plan.role==='setup'&&rules.drops.includes(k))return false;
 if(plan.core.includes('sunnyday')&&M.moves[k].type==='Water')return false;
 if(plan.core.includes('raindance')&&M.moves[k].type==='Fire')return false;
 return true;
}
function compatible(keys,c,plan,lane,spec,complete){
 const all=[...plan.core,...keys];
 // Egg-only combinations are deliberately conservative, even for newer games.
 if(all.filter(k=>c.egg.includes(k)).length>1)return false;
 if(keys.filter(k=>!usefulAttack(k)).length>1)return false;
 if(keys.filter(k=>M.moves[k].priority>0).length>1)return false;
 if(keys.filter(k=>accuracy(k)<85).length>1)return false;
 if(keys.filter(k=>rules.drops.includes(k)).length>1)return false;
 for(let i=0;i<keys.length;i++)for(let j=0;j<i;j++){
  const a=keys[i],b=keys[j],ma=M.moves[a],mb=M.moves[b];
  if(ma.type!==mb.type)continue;
  if(keys.filter(k=>M.moves[k].type===ma.type).length>2)return false;
  // A strong STAB plus its priority or utility counterpart has a purpose;
  // two ordinary attacks of the same type merely waste a slot.
  const complementary=(ma.priority>0)!==(mb.priority>0)||rules.utilityAttacks.includes(a)!==rules.utilityAttacks.includes(b);
  if(!complementary)return false;
 }
 if(!complete)return true;
 if(all.length!==4||keys.filter(usefulAttack).length<2)return false;
 if(lane.requireStab&&!keys.some(k=>stab(k,spec)))return false;
 if(lane.coverage&&keys.every(k=>M.moves[k].type===M.moves[keys[0]].type))return false;
 if(c.signature&&!all.includes(c.signature))return false;
 if(plan.core.includes('raindance')&&!keys.some(k=>M.moves[k].type==='Water')&&!c.abilities.some(a=>rules.weather.raindance.includes(a)))return false;
 if(plan.core.includes('sunnyday')&&!keys.some(k=>M.moves[k].type==='Fire')&&!c.abilities.some(a=>rules.weather.sunnyday.includes(a)))return false;
 if(plan.core.includes('electricterrain')&&!keys.some(k=>M.moves[k].type==='Electric')&&!c.abilities.includes('quarkdrive'))return false;
 if(lane.mode==='Mixed'&&(!keys.some(k=>M.moves[k].category==='Physical')||!keys.some(k=>M.moves[k].category==='Special')))return false;
 if(plan.role==='setup'&&keys.filter(k=>k!=='nightshade'&&usefulAttack(k)).length<2)return false;
 if(plan.core.includes('agility')&&keys.filter(usefulAttack).length<3)return false;
 return true;
}
function findMoves(c,lane,plan,spec,rng=null,budget=192){
 // One jittered ordering per entity, then bounded depth-four backtracking.
 // No catalogue of all n-choose-4 combinations is kept in memory.
 const ranked=lane.attacks.filter(k=>allowedAttack(k,plan)).map(k=>({k,score:moveScore(k,spec)*(rng?(0.55+rng.next()):1)+(k===c.signature?160:0)}));
 ranked.sort((a,b)=>b.score-a.score);
 const pool=ranked.map(x=>x.k),chosen=[];let visits=0;
 const walk=start=>{
  visits++;if(visits>budget)return false;
  const left=4-plan.core.length-chosen.length;
  if(!left)return compatible(chosen,c,plan,lane,spec,true);
  if(pool.length-start<left)return false;
  if(c.signature&&!chosen.includes(c.signature)&&!pool.slice(start).includes(c.signature))return false;
  if(lane.requireStab&&!chosen.some(k=>stab(k,spec))&&!pool.slice(start).some(k=>stab(k,spec)))return false;
  for(let i=start;i<=pool.length-left;i++){
   if(visits>budget)return false;
   chosen.push(pool[i]);if(compatible(chosen,c,plan,lane,spec,false)&&walk(i+1))return true;chosen.pop();
  }
  return false;
 };
 return walk(0)?[...plan.core,...chosen]:null;
}
function compileLane(c,lane,spec){
 // Build-time derivation: retain only feasible plans and one safe witness.
 // The witness is a bounded-search fallback, never the live sampling catalogue.
 const coverageTypes=[];for(const k of lane.attacks)if(usefulAttack(k)&&M.moves[k].type!=='Normal'&&!coverageTypes.includes(M.moves[k].type))coverageTypes.push(M.moves[k].type);
 if(coverageTypes.length>=2)lane.attacks=lane.attacks.filter(k=>M.moves[k].type!=='Normal'||spec.types.includes('Normal')||M.moves[k].priority>0||rules.utilityAttacks.includes(k));
 lane.requireStab=lane.attacks.some(k=>stab(k,spec));
 lane.coverage=lane.attacks.some(k=>usefulAttack(k)&&M.moves[k].type!==M.moves[lane.attacks[0]].type);
 lane.plans=[];
 for(const plan of makePlans(c,lane,spec)){
  const witness=findMoves(c,lane,plan,spec,null,16000);
  if(witness)lane.plans.push({...plan,witness});
 }
 return lane;
}
function chooseAbility(c,keys,plan,spec,rng){
 let best='',score=-1e9;
 for(const a of c.abilities){
  if(plan.core.includes('electricterrain')&&a==='levitate')continue;
  if(plan.role==='weather'&&a==='sandstream')continue;
  let value=8+rng.next()*8;
  if(['intimidate','magicguard','levitate','naturalcure','serenegrace','technician','ironfist','defiant'].includes(a))value+=4;
  if(a==='technician'&&keys.some(k=>M.moves[k].category!=='Status'&&M.moves[k].power>0&&M.moves[k].power<=60))value+=10;
  if(a==='ironfist'&&keys.some(k=>['firepunch','icepunch','thunderpunch','machpunch','bulletpunch','drainpunch'].includes(k)))value+=10;
  if(a==='serenegrace'&&keys.some(k=>M.moves[k].effectChance>0))value+=7;
  if(a==='compoundeyes'&&keys.some(k=>accuracy(k)<95))value+=8;
  for(const weather of plan.core)if(rules.weather[weather]&&rules.weather[weather].includes(a))value+=20;
  if(a==='baddreams'&&keys.some(k=>['sleeppowder','yawn'].includes(k)))value+=10;
  if(value>score){score=value;best=a}
 }
 return best;
}
function gearOptions(keys,plan,spec,ability,evs){
 const attacks=keys.filter(k=>M.moves[k].category!=='Status'),physical=attacks.some(k=>M.moves[k].category==='Physical'),special=attacks.some(k=>M.moves[k].category==='Special');
 const options=[],add=k=>{if(P.itemNames[k]&&!options.includes(k))options.push(k)};
 const recovery=keys.some(k=>rules.recovery.includes(k)||['leechseed','toxic'].includes(k));
 if(keys.some(k=>['reflect','lightscreen'].includes(k)))add('lightclay');
 if(keys.includes('raindance'))add('damprock');
 if(plan.role==='assault'&&attacks.length===4&&!keys.some(k=>['gigatonhammer','rapidspin','nightshade'].includes(k))){
  if(!special)add('choiceband');if(!physical)add('choicespecs');
  if(spec.baseStats.spe>=60)add('choicescarf');
 }
 if(recovery||['bulky','screens','utility'].includes(plan.role)){add(spec.types.includes('Poison')?'blacksludge':'leftovers');add('sitrusberry');add('lumberry')}
 if(!['bulky','screens'].includes(plan.role)||ability==='magicguard')add('lifeorb');
 if(attacks.filter(usefulAttack).length>=3&&attacks.some(k=>M.moves[k].type!==M.moves[attacks[0]].type))add('expertbelt');
 if(keys.some(k=>rules.drops.includes(k)||k==='closecombat'))add('whiteherb');
 if(plan.role!=='bulky'&&!recovery&&evs.hp<128&&Math.min(spec.baseStats.def,spec.baseStats.spd)<85&&ability!=='sandstream'&&!keys.some(k=>['sandstorm','flareblitz','bravebird','woodhammer','takedown'].includes(k)))add('focussash');
 add('sitrusberry');add('lumberry');add(spec.types.includes('Poison')?'blacksludge':'leftovers');
 if(!['bulky','screens'].includes(plan.role)){
  if(physical&&!special)add('muscleband');if(special&&!physical)add('wiseglasses');
  const strongest=attacks.filter(k=>stab(k,spec)).sort((a,b)=>moveScore(b,spec)-moveScore(a,spec))[0];
  if(strongest)add(rules.typeItems[M.moves[strongest].type]);
 }
 return options.map(item=>({item,itemZh:P.itemNames[item]}));
}
function spread(lane,plan,spec,rng){
 const st=spec.baseStats,evs={hp:0,atk:0,def:0,spa:0,spd:0,spe:0};
 const physical=lane.mode==='Physical'||(lane.mode==='Mixed'&&st.atk>=st.spa),offense=physical?'atk':'spa';let nature='Hardy';
 if(plan.role==='screens'||(plan.role==='utility'&&plan.core.length===2)){
  const fast=st.spe>=65;evs.hp=252;evs[fast?'spe':'def']=252;evs[offense]=4;
  nature=fast?(physical?'Jolly':'Timid'):(physical?'Impish':'Bold');
 }else if(plan.role==='bulky'&&plan.core.length===2){
  const def=rng.chance(50)?'def':'spd';evs.hp=252;evs[def]=252;evs[offense]=4;
  nature=def==='def'?(physical?'Impish':'Bold'):(physical?'Careful':'Calm');
 }else{
  const fast=st.spe>=65||plan.role==='setup'||plan.role==='weather';evs[offense]=252;evs[fast?'spe':'hp']=252;evs[fast?'hp':'spd']=4;
  nature=fast&&st.spe>=80?(physical?'Jolly':'Timid'):(physical?'Adamant':'Modest');
 }
 if(lane.mode==='Mixed'){
  // Invest in both offensive stats and never lower either with the nature.
  evs.atk=physical?128:124;evs.spa=physical?124:128;evs.def=0;evs.spd=4;evs.hp=st.spe>=65?0:252;evs.spe=st.spe>=65?252:0;
  nature=st.spe>=65?'Naive':st.atk>=st.spa?'Brave':'Quiet';
 }
 return{evs,nature,natureZh:P.natureNames[nature]};
}
function generate(base,rng){
 const row=P.species[base.num],spec=M.species[D.toID(base.species)];
 if(!row||!row.cohorts.length)throw Error('Missing legal rental pool '+base.num);
 const c=row.cohorts[rng.int(0,row.cohorts.length)],lane=c.lanes[rng.int(0,c.lanes.length)];
 // Pick a role before a plan: species with many status moves must not become
 // overwhelmingly defensive just because they have more support combinations.
 const roleWeights=['assault','assault','assault','setup','setup','setup','bulky','bulky','utility','utility','screens','weather'];
 const roles=roleWeights.filter(r=>lane.plans.some(p=>p.role===r)),role=roles[rng.int(0,roles.length)];
 const plans=lane.plans.filter(p=>p.role===role),plan=plans[rng.int(0,plans.length)];
 const chosen=findMoves(c,lane,plan,spec,rng)||plan.witness.slice();
 const attacks=chosen.filter(k=>M.moves[k].category!=='Status').sort((a,b)=>moveScore(b,spec)-moveScore(a,spec));
 const keys=[...attacks,...chosen.filter(k=>M.moves[k].category==='Status')];
 const ability=chooseAbility(c,keys,plan,spec,rng),training=spread(lane,plan,spec,rng);
 const items=gearOptions(keys,plan,spec,ability,training.evs);
 // Prefer role-specific gear, while keeping coherent alternatives for the
 // factory's shared-item clause. Never attach the learnset to a battle entity.
 const preferred=items.slice(0,3),first=preferred[rng.int(0,preferred.length)];
 const itemOptions=[first,...rng.shuffle(items.filter(x=>x.item!==first.item))];
 return {key:base.key+'-r'+rng.int(1,2147483646),num:base.num,name:base.name,species:base.species,
  level:base.level,ivs:{...base.ivs},pool:base.pool,bst:base.bst,generation:base.generation,
  origin:'generated',generatorVersion:P.schema,learnsetVersion:c.version,buildRole:role,
  moves:keys,ability,abilityZh:P.abilityNames[ability],...training,...first,itemOptions};
}
const api={generate,compileLane};root.FactoryRentalGenerator=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
