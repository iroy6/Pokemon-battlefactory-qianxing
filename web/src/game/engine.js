/* Offline, deterministic single-battle implementation for the documented rental pool.
 * No npm imports, remote services, DOM access or wall-clock dependence.
 * This is a separately implemented prototype, not the Showdown engine.
 */
(function(root){
'use strict';
const D=root.FactoryData||(typeof require==='function'?require('../data/species-data.js'):null);
const M=root.FactoryMeta||(typeof require==='function'?require('../data/meta.js'):null);
const G=root.FactoryRentalGenerator||(typeof require==='function'?require('./rental-generator.js'):null);
const id=D.toID, clone=x=>JSON.parse(JSON.stringify(x)), clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const stats=['hp','atk','def','spa','spd','spe'];
const statZh={atk:'攻击',def:'防御',spa:'特攻',spd:'特防',spe:'速度',accuracy:'命中',evasion:'闪避'};
const statusZh={psn:'中毒',tox:'剧毒',brn:'灼伤',par:'麻痹',slp:'睡眠',frz:'冰冻'};
const natures=M.natures;
class RNG{constructor(seed){this.seed=(Math.floor(Number(seed)||1)%2147483646+2147483646)%2147483646+1}next(){this.seed=this.seed*16807%2147483647;return(this.seed-1)/2147483646}int(a,b){return a+Math.floor(this.next()*(b-a))}chance(n,d=100){return this.next()*d<n}shuffle(xs){const a=xs.slice();for(let i=a.length-1;i>0;i--){const j=this.int(0,i+1);[a[i],a[j]]=[a[j],a[i]]}return a}}
const stage=(n,accuracy=false)=>{const b=accuracy?3:2;return n>=0?(b+n)/b:b/(b-n)};
const moveName=k=>D.moveNames[k]||k;
function createMon(set){
 const spec=M.species[id(set.species)];if(!spec)throw Error('Missing species '+set.species);
 const values={};const nat=natures[set.nature]||[];
 for(const s of stats){let v=Math.floor((2*spec.baseStats[s]+(set.ivs[s]||0)+Math.floor((set.evs[s]||0)/4))*set.level/100);values[s]=s==='hp'?v+set.level+10:Math.floor((v+5)*(nat[0]===s?1.1:nat[1]===s?.9:1))}
 const m={...clone(set),stats:values,types:spec.types.slice(),weight:spec.weight,hp:values.hp,maxhp:values.hp,status:'',sleep:0,toxic:0,itemActive:true,itemLost:false,boosts:{atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0},vol:{},moves:set.moves.map(n=>{const k=id(n);if(!M.moves[k])throw Error('Missing move '+n);return{id:k,pp:M.moves[k].pp,maxpp:M.moves[k].pp}}),seen:[],revealedAbility:false,revealedItem:false,lastMove:'',lastReceived:'',activeTurns:0};
 delete m.itemOptions;return m;
}
function heal(m){m.types=M.species[id(m.species)].types.slice();m.hp=m.maxhp;m.status='';m.sleep=0;m.toxic=0;m.itemActive=true;m.itemLost=false;m.vol={};m.boosts={atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0};m.lastMove='';m.lastReceived='';m.activeTurns=0;for(const x of m.moves)x.pp=x.maxpp;return m}
const soundMoves=new Set(['sing','supersonic','roar','metalsound','screech','growl','grasswhistle','torchsong','bugbuzz']);
const contactMoves=new Set(Object.keys(M.moves).filter(k=>M.moves[k].contact));
const selfMoves=new Set(['withdraw','protect','agility','doubleteam','followme','moonlight','watersport','barrier','defensecurl','swordsdance','acupressure','acidarmor','minimize','grudge','detect','harden','irondefense','howl','mudsport','calmmind','dragondance','amnesia','roost','recover','quiverdance']);
const sideMoves=new Set(['tailwind','mist','reflect','lightscreen','stealthrock','safeguard']);
const weatherMoves=new Set(['raindance','sandstorm','sunnyday','electricterrain']);
const punchMoves=new Set(['firepunch','icepunch','thunderpunch','machpunch','bulletpunch','drainpunch']);
const boosts={amnesia:['spd',2],withdraw:['def',1],agility:['spe',2],doubleteam:['evasion',1],barrier:['def',2],defensecurl:['def',1],swordsdance:['atk',2],acidarmor:['def',2],minimize:['evasion',1],smokescreen:['accuracy',-1],scaryface:['spe',-2],featherdance:['atk',-2],sandattack:['accuracy',-1],sweetscent:['evasion',-1],tailwhip:['def',-1],metalsound:['spd',-2],leer:['def',-1],screech:['def',-2],cottonspore:['spe',-2],flash:['accuracy',-1],growl:['atk',-1],harden:['def',1],howl:['atk',1],irondefense:['def',2]};
const statusMoves={sleeppowder:'slp',toxic:'tox',thunderwave:'par',willowisp:'brn',stunspore:'par',poisonpowder:'psn',sing:'slp',grasswhistle:'slp'};
const confusionMoves=new Set(['confuseray','supersonic','sweetkiss']);
const noAssist=new Set(['assist','mirrormove','protect','followme','grudge','struggle','detect','whirlwind']);
const noMirror=new Set([...selfMoves,...sideMoves,...weatherMoves,'assist','mirrormove','struggle']);
class Battle{
 constructor(team,enemy,seed=1){this.rng=new RNG(seed);this.aiRng=new RNG(seed+11939);this.sides=[{team:clone(team),active:0,conditions:{}},{team:clone(enemy),active:0,conditions:{}}];for(const side of this.sides){side.lastSwitchTurn=-99;side.previousActive=-1;for(const m of side.team){m.seen=[];m.revealedAbility=false;m.revealedItem=false}}this.phase='battle';this.turn=1;this.weather='';this.weatherLeft=0;this.terrain='';this.terrainLeft=0;this.events=[];this.log=[];this.actions=[];this.inputs=[];this.lastUsed='';this.emit('battle_start','对战开始！');const order=this.speedOrder();for(const s of order)this.enter(s);this.enemyChoice=this.chooseAI(1)}
 mon(s){return this.sides[s].team[this.sides[s].active]}
 emit(kind,text,side=null,extra={}){const visual=this.sides.map((row)=>{const m=row.team[row.active];return{num:m.num,name:m.name,hp:m.hp,maxhp:m.maxhp,status:m.status,underground:!!m.vol.dig,alive:row.team.map(x=>x.hp>0)}});const e={kind,text,side,turn:this.turn,...extra,visual,environment:{weather:this.weather,left:this.weatherLeft,terrain:this.terrain,terrainLeft:this.terrainLeft,sides:this.sides.map(s=>({conditions:{...s.conditions},watersport:!!s.team[s.active].vol.watersport,mudsport:!!s.team[s.active].vol.mudsport}))}};this.events.push(e);this.log.push(e);if(!this.transcript)this.transcript=[];this.transcript.push({kind,text,turn:this.turn});if(this.log.length>800)this.log.shift();return e}
 ability(m,s,text=null){m.revealedAbility=true;this.emit('ability',text||`${m.name}的「${m.abilityZh}」发动了！`,s,{ability:id(m.ability)})}
 item(m,s){m.revealedItem=true;this.emit('item',`${m.name}使用了${m.itemZh}！`,s,{item:id(m.item)})}
 enter(s){const m=this.mon(s);m.activeTurns=0;this.emit('switch',`${s===0?'你派出了':'对手派出了'}${m.name}！`,s);if(this.sides[s].conditions.stealthrock){this.damage(s,Math.max(1,Math.floor(m.maxhp*this.effectiveness('Rock',m)/8)),'隐形岩',false);if(!m.hp)return}if(id(m.ability)==='sandstream'&&this.weather!=='sandstorm'){this.ability(m,s);this.weather='sandstorm';this.weatherLeft=-1;this.emit('weather','扬沙带来了持续的沙暴！',s)}if(id(m.ability)==='pressure')this.ability(m,s,`${m.name}施加了压迫感！`);if(id(m.ability)==='intimidate'&&this.mon(1-s).hp){this.ability(m,s);this.boost(1-s,'atk',-1,s)}if(id(m.ability)==='download'){this.ability(m,s);const foe=this.mon(1-s);this.boost(s,foe.stats.def*stage(foe.boosts.def)<foe.stats.spd*stage(foe.boosts.spd)?'atk':'spa',1)}this.refreshFieldAbilities()}
 highestStat(m,withStages=false){return ['atk','def','spa','spd','spe'].reduce((best,k)=>m.stats[k]*(withStages?stage(m.boosts[k]):1)>m.stats[best]*(withStages?stage(m.boosts[best]):1)?k:best,'atk')}
 grounded(m){return !m.types.includes('Flying')&&id(m.ability)!=='levitate'&&!m.vol.dig}
 refreshFieldAbilities(){for(const side of [0,1]){const m=this.mon(side),a=id(m.ability),active=m.hp&&((a==='protosynthesis'&&this.weather==='sun')||(a==='quarkdrive'&&this.terrain==='electric'));if(active&&!m.vol.paradox){m.vol.paradox={stat:this.highestStat(m,true)};this.ability(m,side);this.emit('field',`${m.name}的${statZh[m.vol.paradox.stat]}受到了强化！`,side)}else if(!active&&m.vol.paradox){delete m.vol.paradox;this.emit('field',`${m.name}的环境强化结束了。`,side)}}}
 paradoxMultiplier(m,key){return m.vol.paradox?.stat===key?(key==='spe'?1.5:1.3):1}
 speed(s,mon=this.mon(s)){let n=Math.floor(mon.stats.spe*stage(mon.boosts.spe));if(this.weather==='rain'&&id(mon.ability)==='swiftswim')n*=2;if(this.weather==='sun'&&id(mon.ability)==='chlorophyll')n*=2;n=Math.floor(n*this.paradoxMultiplier(mon,'spe'));if(mon.itemActive&&id(mon.item)==='choicescarf')n=Math.floor(n*1.5);if(mon.status==='par')n=Math.floor(n/4);if(this.sides[s].conditions.tailwind)n*=2;return Math.max(1,n)}
 speedOrder(){const a=this.speed(0),b=this.speed(1);return b>a||(b===a&&this.rng.chance(50))?[1,0]:[0,1]}
 effectiveness(type,target){if(type==='???')return 1;return target.types.reduce((v,t)=>{if(target.vol.foresight&&t==='Ghost'&&(type==='Normal'||type==='Fighting'))return v;return v*(M.chart[type]?.[t]??1)},1)}
 usable(s){const m=this.mon(s);if(m.vol.dig){const index=m.vol.dig.index;return[{...m.moves[index],index,id:'dig',disabled:false}]};return m.moves.map((x,i)=>({...x,index:i,disabled:x.pp<=0||(m.itemActive&&['choiceband','choicespecs','choicescarf'].includes(id(m.item))&&m.vol.choiceLock&&m.vol.choiceLock!==x.id)||(x.id==='gigatonhammer'&&m.lastMove===x.id&&m.vol.encore?.id!==x.id)||(m.vol.disable?.id===x.id)||(m.vol.encore&&m.vol.encore.id!==x.id)}))}
 choices(s){return this.usable(s).filter(x=>!x.disabled)}
 switchable(s){const side=this.sides[s];return side.team.map((m,i)=>({m,i})).filter(x=>x.i!==side.active&&x.m.hp>0).map(x=>x.i)}
 canSwitch(s){const a=this.mon(s),b=this.mon(1-s);return !a.vol.wrap&&!a.vol.dig&&!(b.hp&&id(b.ability)==='magnetpull'&&a.types.includes('Steel'))}
 boost(s,key,amount,source=s,deferHerb=false){const m=this.mon(s);if(amount<0&&source!==s){if(this.sides[s].conditions.mist){this.emit('blocked',`${m.name}受到白雾的保护。`,s);return false}if(id(m.ability)==='clearbody'||(key==='atk'&&id(m.ability)==='hypercutter')||(key==='accuracy'&&id(m.ability)==='keeneye')){this.ability(m,s);return false}}
 const before=m.boosts[key];m.boosts[key]=clamp(before+amount,-6,6);if(before===m.boosts[key]){this.emit('fail',`${m.name}的${statZh[key]}已经无法${amount>0?'提高':'降低'}！`,s);return false}this.emit('boost',`${m.name}的${statZh[key]}${amount>0?'提高':'降低'}了${Math.abs(m.boosts[key]-before)>1?'大幅度':'一级'}！`,s);if(amount<0&&source!==s&&id(m.ability)==='defiant'){this.ability(m,s);this.boost(s,'atk',2)}if(!deferHerb)this.checkHerb(s);return true}
 checkHerb(s){const m=this.mon(s);if(m.itemActive&&id(m.item)==='whiteherb'&&Object.values(m.boosts).some(v=>v<0)){this.item(m,s);m.itemActive=false;for(const k of Object.keys(m.boosts))if(m.boosts[k]<0)m.boosts[k]=0;this.emit('cure',`${m.name}的能力下降被白色香草恢复了。`,s)}}
 secondary(s,n){return this.rng.chance(Math.min(100,n*(id(this.mon(s).ability)==='serenegrace'?2:1)))}
 restore(s,n,reason){const m=this.mon(s);if(m.hp<=0)return 0;const delta=Math.min(m.maxhp-m.hp,Math.max(1,Math.floor(n)));m.hp+=delta;if(delta)this.emit('heal',`${m.name}${reason?'通过'+reason:''}恢复了 ${delta} HP。`,s,{amount:delta});return delta}
 damage(s,n,reason,direct=true,source=null,move=null){const m=this.mon(s);if(!m.hp)return 0;if(!direct&&id(m.ability)==='magicguard'&&reason!=='混乱自伤'&&reason!=='挣扎反作用')return 0;let v=Math.min(m.hp,Math.max(1,Math.floor(n)));if(direct&&v>=m.hp&&m.vol.sashMove){v=m.hp-1;m.vol.sashUsed=true}else if(direct&&v>=m.hp&&m.hp===m.maxhp&&m.itemActive&&id(m.item)==='focussash'){this.item(m,s);m.itemActive=false;v=m.hp-1;this.emit('endure',`${m.name}靠气势披带坚持住了！`,s)}if(direct&&v>=m.hp&&m.itemActive&&id(m.item)==='focusband'&&this.rng.chance(10)){this.item(m,s);v=m.hp-1;this.emit('endure',`${m.name}靠气势头带坚持住了！`,s)}m.hp-=v;m.vol.damaged=true;if(direct&&source!==null&&move)m.vol.attackedBy=source;this.emit('damage',`${m.name}${reason?'受到'+reason:''}损失了 ${v} HP。`,s,{amount:v});if(!m.hp){this.emit('faint',`${m.name}倒下了！`,s);if(direct&&source!==null&&source!==s&&move){const victor=this.mon(source),va=id(victor.ability);if(victor.hp&&['beastboost','chillingneigh','grimneigh'].includes(va)){this.ability(victor,source);this.boost(source,va==='chillingneigh'?'atk':va==='grimneigh'?'spa':this.highestStat(victor),1)}}if(m.vol.grudge&&direct&&source!==null&&move){const attacker=this.mon(source);const slot=attacker.moves.find(x=>x.id===move.id);if(slot)slot.pp=0;this.emit('grudge',`${attacker.name}的${moveName(move.id)}PP归零了！`,source)}}else this.checkBerry(s);return v}
 consumeBerry(s,itemKey,stolen=false){
  if(!this.berryReady(s,itemKey,stolen))return false;
  const m=this.mon(s);
  if(itemKey==='lumberry'){
   const cured=(statusZh[m.status]||'')+(m.status&&m.vol.confusion?'与':'')+(m.vol.confusion?'混乱':'');
   m.status='';m.sleep=0;m.toxic=0;delete m.vol.confusion;this.emit('cure',`${m.name}的${cured}恢复了。`,s);
  }else if(['cheriberry','chestoberry','pechaberry','rawstberry','aspearberry'].includes(itemKey)){
   const cured=statusZh[m.status];m.status='';m.sleep=0;m.toxic=0;this.emit('cure',`${m.name}的${cured}恢复了。`,s);
  }else if(itemKey==='persimberry'){delete m.vol.confusion;this.emit('cure',`${m.name}不再混乱。`,s)}
  else if(itemKey==='sitrusberry')this.restore(s,Math.floor(m.maxhp/4),'文柚果');
  else this.boost(s,itemKey==='liechiberry'?'atk':itemKey==='salacberry'?'spe':'spa',1);
  return true;
 }
 berryReady(s,itemKey,stolen=false){
  const m=this.mon(s);if(!m.hp)return false;
  if(itemKey==='lumberry')return !!(m.status||m.vol.confusion);
  if(itemKey==='persimberry')return !!m.vol.confusion;
  const cures={cheriberry:'par',chestoberry:'slp',pechaberry:'poison',rawstberry:'brn',aspearberry:'frz'};
  if(cures[itemKey])return m.status===cures[itemKey]||(cures[itemKey]==='poison'&&['psn','tox'].includes(m.status));
  if(itemKey==='sitrusberry')return m.hp<m.maxhp&&(stolen||m.hp<=m.maxhp/2);
  return ['liechiberry','petayaberry','salacberry'].includes(itemKey)&&(stolen||m.hp<=m.maxhp/4);
 }
 checkBerry(s){const m=this.mon(s),itemKey=id(m.item);if(!m.itemActive||!this.berryReady(s,itemKey))return;
  // Emit before mutation: both playback clients need the old HP/status, and
  // history must have exactly the same ordering and snapshots as the queue.
  this.item(m,s);m.itemActive=false;this.consumeBerry(s,itemKey);
 }
 // Only publish a reaction after immunity/occupied-status checks succeed. Gen IV
 // contact and secondary effects fail silently; direct status moves explain why.
 setStatus(s,status,source=null,reflected=false,options={}){
  const m=this.mon(s),notify=(kind,text)=>{if(!options.silentFailure)this.emit(kind,text,s)},blockedAbility=()=>{if(!options.silentFailure)this.ability(m,s)};
  if(!m.hp||m.status)return false;
  if(status==='slp'&&this.terrain==='electric'&&this.grounded(m)){notify('blocked',`${m.name}受到电气场地保护，无法入睡。`);return false}
  if(status==='frz'&&this.weather==='sun'){notify('blocked','晴天下无法陷入冰冻。');return false}
  if(!options.bypassSafeguard&&source!==null&&source!==s&&this.sides[s].conditions.safeguard){notify('blocked',`${m.name}受到神秘守护保护。`);return false}
  if(status==='brn'&&['waterveil','thermalexchange'].includes(id(m.ability))){blockedAbility();return false}
  if((['psn','tox'].includes(status)&&m.types.some(t=>['Poison','Steel'].includes(t)))||(status==='brn'&&m.types.includes('Fire'))||(status==='frz'&&m.types.includes('Ice'))){notify('immune',`对${m.name}没有效果。`);return false}
  if(status==='slp'&&id(m.ability)==='insomnia'){blockedAbility();return false}
  options.onApplied?.();m.status=status;if(status==='slp')m.sleep=this.rng.int(2,6);if(status==='tox')m.toxic=0;
  this.emit('status',`${m.name}陷入了${statusZh[status]}！`,s);
  if(!reflected&&source!==null&&source!==s&&id(m.ability)==='synchronize'&&['psn','tox','brn','par'].includes(status))this.setStatus(source,status==='tox'?'psn':status,s,true,{silentFailure:true,onApplied:()=>this.ability(m,s)});
  this.checkBerry(s);return true;
 }
 // Absorbing abilities apply to both damaging and status moves (e.g. Thunder
 // Wave in Gen IV). Called only after the target's Protect/accuracy checks.
 absorb(s,move){const m=this.mon(s),a=id(m.ability);
  if(move.type==='Grass'&&a==='sapsipper'){this.ability(m,s);this.boost(s,'atk',1);return true}
  if(move.type==='Electric'&&a==='motordrive'){this.ability(m,s);this.boost(s,'spe',1);return true}
  if(move.type==='Fire'&&a==='flashfire'&&m.status!=='frz'){m.vol.flashfire=true;this.ability(m,s);return true}
  if((move.type==='Water'&&a==='waterabsorb')||(move.type==='Electric'&&a==='voltabsorb')){this.ability(m,s);this.restore(s,Math.floor(m.maxhp/4),m.abilityZh);return true}
  return false;
 }
 confuse(s,source=1-s,options={}){const m=this.mon(s);if(source!==s&&this.sides[s].conditions.safeguard){if(!options.silentFailure)this.emit('blocked',`${m.name}受到神秘守护保护。`,s);return false}if(!m.hp||m.vol.confusion)return false;if(id(m.ability)==='owntempo'){if(!options.silentFailure)this.ability(m,s);return false}m.vol.confusion=this.rng.int(2,6);this.emit('confusion',`${m.name}混乱了！`,s);this.checkBerry(s);return true}
 beforeMove(s,move){const m=this.mon(s);m.vol.moved=true;if(m.status==='slp'){m.sleep-=id(m.ability)==='earlybird'?2:1;if(m.sleep<=0){m.status='';this.emit('cure',`${m.name}醒来了！`,s)}else{this.emit('cant',`${m.name}正在睡觉。`,s);return false}}if(m.status==='frz'){if(['flamewheel','flareblitz','scald'].includes(move.id)||this.rng.chance(20)){m.status='';this.emit('cure',`${m.name}解冻了！`,s)}else{this.emit('cant',`${m.name}被冻住了！`,s);return false}}if(m.vol.flinch){this.emit('cant',`${m.name}畏缩了，无法行动！`,s);return false}if(m.vol.disable?.id===move.id){this.emit('cant',`${moveName(move.id)}被定身法封住了！`,s);return false}if(m.vol.confusion){m.vol.confusion--;if(m.vol.confusion===0){delete m.vol.confusion;this.emit('cure',`${m.name}不再混乱。`,s)}else{this.emit('confusion',`${m.name}正在混乱中。`,s);if(this.rng.chance(50)){const a=Math.floor(m.stats.atk*stage(m.boosts.atk));const d=Math.floor(m.stats.def*stage(m.boosts.def));let v=Math.floor(Math.floor((2*m.level/5+2)*40*a/d)/50);if(m.status==='brn'&&id(m.ability)!=='guts')v=Math.floor(v/2);this.damage(s,Math.floor((v+2)*this.rng.int(85,101)/100),'混乱自伤',false);return false}}}if(m.status==='par'&&id(m.ability)!=='magicguard'&&this.rng.chance(25)){this.emit('cant',`${m.name}因麻痹无法行动！`,s);return false}return true}
 hitCheck(s,move){const a=this.mon(s),b=this.mon(1-s);if(b.vol.dig&&!['magnitude','earthquake'].includes(move.id)){this.emit('miss',`${b.name}躲在地下，招式没有命中！`,1-s);return false}if(b.vol.protect){this.emit('blocked',`${b.name}守住了攻击！`,1-s);return false}if(soundMoves.has(move.id)&&id(b.ability)==='soundproof'){this.ability(b,1-s);return false}if(move.accuracy===true)return true;let chance=move.accuracy*stage(a.boosts.accuracy,true)/stage(move.id==='sacredsword'?0:b.vol.foresight?Math.min(0,b.boosts.evasion):b.boosts.evasion,true);if(id(a.ability)==='compoundeyes')chance*=1.3;if(id(a.ability)==='victorystar')chance*=1.1;if(b.itemActive&&id(b.item)==='brightpowder')chance*=.9;if(this.weather==='sandstorm'&&id(b.ability)==='sandveil')chance*=.8;if(!this.rng.chance(chance)){this.emit('miss',`${a.name}的招式没有命中！`,s);return false}return true}
 calculate(s,move,{critical=false,roll=100,power=null,target=null,attacker=null}={}){const a=attacker||this.mon(s),b=target||this.mon(1-s);let p=power??move.power;if(['magnitude','earthquake'].includes(move.id)&&b.vol.dig)p*=2;if(move.id==='avalanche'&&a.vol.attackedBy===1-s)p*=2;if(move.id==='grassknot')p=b.weight<10?20:b.weight<25?40:b.weight<50?60:b.weight<100?80:b.weight<200?100:120;if(move.id==='assurance'&&b.vol.damaged)p*=2;if(move.id==='facade'&&['psn','tox','brn','par'].includes(a.status))p*=2;if(move.id==='wakeupslap'&&b.status==='slp')p*=2;if(move.id==='stomp'&&b.vol.minimize)p*=2;const technicianEligible=p<=60;const boostsByType={overgrow:'Grass',blaze:'Fire',torrent:'Water',swarm:'Bug'};if(boostsByType[id(a.ability)]===move.type&&a.hp<=a.maxhp/3)p=Math.floor(p*1.5);if(id(b.ability)==='thickfat'&&['Fire','Ice'].includes(move.type))p=Math.floor(p/2);if(id(a.ability)==='technician'&&technicianEligible)p=Math.floor(p*1.5);if(id(a.ability)==='ironfist'&&punchMoves.has(move.id))p=Math.floor(p*1.2);if(id(a.ability)==='sandforce'&&this.weather==='sandstorm'&&['Rock','Ground','Steel'].includes(move.type))p=Math.floor(p*1.3);if(this.terrain==='electric'&&move.type==='Electric'&&this.grounded(a))p=Math.floor(p*1.3);const itemTypes={seaincense:'Water',roseincense:'Grass',miracleseed:'Grass',silverpowder:'Bug',charcoal:'Fire',softsand:'Ground',poisonbarb:'Poison',hardstone:'Rock',oddincense:'Psychic',twistedspoon:'Psychic',magnet:'Electric',mysticwater:'Water',blackglasses:'Dark',metalcoat:'Steel',spelltag:'Ghost',dragonfang:'Dragon',sharpbeak:'Flying'};if(a.itemActive&&((id(a.item)==='muscleband'&&move.category==='Physical')||(id(a.item)==='wiseglasses'&&move.category==='Special')))p=Math.floor(p*1.1);if(a.itemActive&&itemTypes[id(a.item)]===move.type)p=Math.floor(p*1.2);if(move.type==='Fire'&&this.sides.some(x=>x.team[x.active].vol.watersport))p=Math.floor(p/2);
 if(move.type==='Electric'&&this.sides.some(x=>x.team[x.active].vol.mudsport))p=Math.floor(p/2);
 const physical=move.category==='Physical',ak=physical?'atk':'spa',dk=physical||['secretsword','psyshock'].includes(move.id)?'def':'spd';let attack=Math.floor(a.stats[ak]*stage(critical?Math.max(0,a.boosts[ak]):a.boosts[ak]));let defense=Math.floor(b.stats[dk]*stage(move.id==='sacredsword'?0:critical?Math.min(0,b.boosts[dk]):b.boosts[dk]));attack=Math.floor(attack*this.paradoxMultiplier(a,ak));if(a.itemActive&&id(a.item)===(physical?'choiceband':'choicespecs'))attack=Math.floor(attack*1.5);defense=Math.floor(defense*this.paradoxMultiplier(b,dk));if(id(a.ability)==='defeatist'&&a.hp<=a.maxhp/2)attack=Math.floor(attack/2);if(dk==='def'&&b.status&&id(b.ability)==='marvelscale')defense=Math.floor(defense*1.5);if(physical&&a.status&&id(a.ability)==='guts')attack=Math.floor(attack*1.5);if(dk==='spd'&&this.weather==='sandstorm'&&b.types.includes('Rock'))defense=Math.floor(defense*1.5);let n=Math.floor(Math.floor(Math.floor((2*a.level/5+2)*Math.max(1,p)*attack)/Math.max(1,defense))/50);if(physical&&a.status==='brn'&&id(a.ability)!=='guts')n=Math.floor(n/2);if(!critical&&this.sides[1-s].conditions[physical?'reflect':'lightscreen'])n=Math.floor(n/2);if(this.weather==='rain'){if(move.type==='Water')n=Math.floor(n*1.5);if(move.type==='Fire')n=Math.floor(n/2)}if(this.weather==='sun'){if(move.type==='Fire')n=Math.floor(n*1.5);if(move.type==='Water')n=Math.floor(n/2)}if(a.vol.flashfire&&move.type==='Fire')n=Math.floor(n*1.5);n+=2;if(critical)n*=2;if(a.itemActive&&id(a.item)==='lifeorb')n=Math.floor(n*1.3);n=Math.floor(n*roll/100);if(move.id!=='struggle'&&a.types.includes(move.type))n=Math.floor(n*1.5);const eff=move.id==='struggle'?1:this.effectiveness(move.type,b);n=Math.floor(n*eff);if(eff>1&&a.itemActive&&id(a.item)==='expertbelt')n=Math.floor(n*1.2);if(eff>1&&id(b.ability)==='prismarmor')n=Math.floor(n*.75);return eff===0?0:Math.max(1,n)}
 use(s,moveId,called=false,depth=0){if(depth>2){this.emit('fail','招式发动失败。',s);return}const a=this.mon(s),b=this.mon(1-s);if(a.vol.dig&&!called)moveId='dig';let move=M.moves[moveId];if(!move)throw Error('Unimplemented move '+moveId);if(!a.hp||!b.hp)return;
 if(!called){if(a.vol.encore){const forced=a.moves.find(x=>x.id===a.vol.encore.id&&x.pp>0);if(forced){moveId=forced.id;move=M.moves[moveId]}}if(moveId==='gigatonhammer'&&a.lastMove===moveId&&a.vol.encore?.id!==moveId){this.emit('cant','巨力锤不能连续使出！',s);return}if(!this.beforeMove(s,move)){if(a.vol.dig)delete a.vol.dig;return}delete a.vol.grudge;if(moveId!=='struggle'&&!a.vol.dig){const slot=a.moves.find(x=>x.id===moveId);if(!slot||slot.pp<=0){this.emit('fail','没有可用PP。',s);return}const pressure=id(b.ability)==='pressure'&&[6,9,10,11,12,14].includes(move.targetId);slot.pp=Math.max(0,slot.pp-(pressure?2:1))}if(!['protect','detect'].includes(moveId))a.vol.protectChain=0;a.lastMove=moveId;a.vol.moved=true;if(moveId!=='struggle'&&a.itemActive&&['choiceband','choicespecs','choicescarf'].includes(id(a.item))&&!a.vol.choiceLock)a.vol.choiceLock=moveId}
 if(!a.seen.includes(moveId))a.seen.push(moveId);this.lastUsed=moveId;this.emit('move',`${a.name}使用了${moveName(moveId)}！`,s,{move:moveId});
 if(moveId==='assist'){const options=this.sides[s].team.filter(m=>m!==a).flatMap(m=>m.moves.map(x=>x.id)).filter(k=>!noAssist.has(k));if(!options.length){this.emit('fail','但是失败了。',s);return}return this.use(s,options[this.rng.int(0,options.length)],true,depth+1)}
 if(moveId==='mirrormove'){if(!a.lastReceived||noMirror.has(a.lastReceived)){this.emit('fail','没有可以模仿的招式。',s);return}return this.use(s,a.lastReceived,true,depth+1)}
 if(moveId==='dig'&&!a.vol.dig){a.vol.dig={index:a.moves.findIndex(x=>x.id===a.lastMove)};this.emit('charge',`${a.name}钻入了地下！`,s);return}if(moveId==='dig')delete a.vol.dig;
 if(moveId==='protect'||moveId==='detect'){const chain=a.vol.protectChain||0;const otherPending=!b.vol.moved;if(!otherPending||!this.rng.chance(1,Math.min(8,2**chain))){a.vol.protectChain=0;this.emit('fail','但是失败了。',s)}else{a.vol.protect=true;a.vol.protectChain=chain+1;this.emit('protect',`${a.name}摆出了防守姿态！`,s)}return}
 if(moveId==='fakeout'&&a.activeTurns>0){this.emit('fail','击掌奇袭只能在上场的第一个行动回合使用。',s);return}
 const targetSelf=selfMoves.has(moveId),targetSide=sideMoves.has(moveId),targetWeather=weatherMoves.has(moveId);
 if(!targetSelf&&!targetSide&&!targetWeather){if(!this.hitCheck(s,move))return;b.lastReceived=moveId}
 if(!targetSelf&&!targetSide&&!targetWeather&&this.absorb(1-s,move))return;if(boosts[moveId]){const [key,n]=boosts[moveId];this.boost(targetSelf?s:1-s,key,n,s);if(moveId==='minimize')a.vol.minimize=true;return}
 if(['calmmind','dragondance','quiverdance'].includes(moveId)){for(const stat of moveId==='quiverdance'?['spa','spd','spe']:moveId==='calmmind'?['spa','spd']:['atk','spe'])this.boost(s,stat,1);return}
 if(moveId==='recover'||moveId==='roost'){if(a.hp===a.maxhp){this.emit('fail','HP已经全满。',s);return}this.restore(s,Math.floor(a.maxhp/2),moveName(moveId));if(moveId==='roost'&&a.types.includes('Flying')){a.vol.roost=a.types.slice();a.types=a.types.filter(t=>t!=='Flying');if(!a.types.length)a.types=['Normal'];this.emit('field',`${a.name}本回合暂时失去了飞行属性。`,s)}return}
 if(moveId==='followme'){this.emit('redirect',`${a.name}成为了注目的焦点。`,s);return}
 if(moveId==='moonlight'){if(a.hp===a.maxhp){this.emit('fail','HP已经全满。',s);return}this.restore(s,Math.floor(a.maxhp*(this.weather==='sun'?2/3:this.weather?1/4:1/2)),'月光');return}
 if(moveId==='electricterrain'){if(this.terrain==='electric'){this.emit('fail','电气场地已经存在。',s);return}this.terrain='electric';this.terrainLeft=5;this.emit('field','脚下展开了电气场地！',s);this.refreshFieldAbilities();return}if(targetWeather){const kind=moveId==='raindance'?'rain':moveId==='sunnyday'?'sun':'sandstorm';if(this.weather===kind){this.emit('fail','天气没有改变。',s);return}this.weather=kind;this.weatherLeft=kind==='rain'&&a.itemActive&&id(a.item)==='damprock'?8:5;this.emit('weather',kind==='rain'?'下起了雨！':kind==='sun'?'阳光变得猛烈了！':'沙暴刮起来了！',s);this.refreshFieldAbilities();return}
 if(targetSide){const side=moveId==='stealthrock'?1-s:s;const conditions=this.sides[side].conditions;if(conditions[moveId]){this.emit('fail','同样的效果已经存在。',s);return}conditions[moveId]=moveId==='stealthrock'?-1:moveId==='tailwind'?3:['reflect','lightscreen'].includes(moveId)&&a.itemActive&&id(a.item)==='lightclay'?8:5;this.emit('field',`${side===0?'我方':'对方'}场地出现了${moveName(moveId)}。`,s);return}
 if(['watersport','mudsport'].includes(moveId)){if(a.vol[moveId])this.emit('fail','相同效果已经生效。',s);else{a.vol[moveId]=true;this.emit('field',`${moveId==='watersport'?'火':'电'}属性招式的威力减弱了。`,s)}return}
 if(statusMoves[moveId]){if(moveId==='thunderwave'&&this.effectiveness('Electric',b)===0){this.emit('immune',`对${b.name}没有效果。`,1-s);return}const before=this.events.length;if(!this.setStatus(1-s,statusMoves[moveId],s)&&this.events.length===before)this.emit('fail','但是没有生效。',s);return}
 if(confusionMoves.has(moveId)){const before=this.events.length;if(!this.confuse(1-s)&&this.events.length===before)this.emit('fail','但是没有生效。',s);return}
 if(moveId==='flatter'||moveId==='swagger'){this.boost(1-s,moveId==='flatter'?'spa':'atk',moveId==='flatter'?1:2,s);this.confuse(1-s);return}
 if(moveId==='tickle'){this.boost(1-s,'atk',-1,s);this.boost(1-s,'def',-1,s);return}
 if(moveId==='spite'){const slot=b.moves.find(x=>x.id===b.lastMove);if(!slot||slot.pp<=0){this.emit('fail','没有可以削减PP的招式。',s);return}const lost=Math.min(4,slot.pp);slot.pp-=lost;this.emit('pp',`${b.name}的${moveName(slot.id)}减少了 ${lost} PP。`,1-s);return}
 if(moveId==='leechseed'){if(b.types.includes('Grass')||b.vol.seed!==undefined){this.emit('fail','寄生种子没有生效。',s);return}b.vol.seed=s;this.emit('seed',`${b.name}被种下了寄生种子！`,1-s);return}
 if(moveId==='foresight'){if(b.vol.foresight){this.emit('fail','但是失败了。',s);return}b.vol.foresight=true;this.emit('identify',`${a.name}识破了${b.name}！`,s);return}
 if(moveId==='disable'||moveId==='encore'){const slot=b.moves.find(x=>x.id===b.lastMove);if(!slot||slot.pp===0||b.vol[moveId]||['struggle','encore','mirrormove'].includes(b.lastMove)){this.emit('fail','没有可生效的招式。',s);return}b.vol[moveId]={id:b.lastMove,left:this.rng.int(4,moveId==='encore'?9:8)+(moveId==='disable'&&b.vol.moved?1:0)};this.emit('lock',`${b.name}的${moveName(b.lastMove)}受到${moveName(moveId)}影响！`,1-s);return}
 if(moveId==='yawn'){if(this.sides[1-s].conditions.safeguard){this.emit('blocked',`${b.name}受到神秘守护保护。`,1-s);return}if(b.status||b.vol.yawn){this.emit('fail','但是失败了。',s);return}if(id(b.ability)==='insomnia'){this.ability(b,1-s);return}b.vol.yawn=2;this.emit('yawn',`${b.name}变得昏昏欲睡。`,1-s);return}
 if(moveId==='roar'||moveId==='whirlwind'){const choices=this.switchable(1-s);if(!choices.length){this.emit('fail','没有可替换的宝可梦。',s);return}this.switch(1-s,choices[this.rng.int(0,choices.length)],true);return}
 if(moveId==='acupressure'){const choices=Object.keys(a.boosts).filter(k=>a.boosts[k]<6);if(!choices.length)this.emit('fail','所有能力都已达到上限。',s);else this.boost(s,choices[this.rng.int(0,choices.length)],2);return}
 if(moveId==='grudge'){a.vol.grudge=true;this.emit('grudge',`${a.name}充满了怨念！`,s);return}
 if(move.category==='Status')throw Error('Unhandled status move '+moveId);
 if(move.type==='Ground'&&id(b.ability)==='levitate'){this.ability(b,1-s);return}if(this.effectiveness(move.type,b)===0&&moveId!=='struggle'){this.emit('immune',`对${b.name}没有效果。`,1-s);return}
 if(moveId==='brickbreak'){const cond=this.sides[1-s].conditions;if(cond.reflect||cond.lightscreen){delete cond.reflect;delete cond.lightscreen;this.emit('field','劈瓦破坏了对方的反射壁与光墙！',s)}}
 let hits=1;if(['doublekick','twineedle'].includes(moveId))hits=2;if(['doubleslap','rockblast','bulletseed'].includes(moveId)){const r=this.rng.int(0,8);hits=r<3?2:r<6?3:r===6?4:5}let power=null;if(moveId==='magnitude'){const r=this.rng.int(0,100);const levels=r<5?[4,10]:r<15?[5,30]:r<35?[6,50]:r<65?[7,70]:r<85?[8,90]:r<95?[9,110]:[10,150];power=levels[1];this.emit('magnitude',`震级为 ${levels[0]}！`,s)}
 if(b.itemActive&&id(b.item)==='focussash'&&b.hp===b.maxhp)b.vol.sashMove=true;let total=0,landed=0;for(let h=0;h<hits&&a.hp&&b.hp;h++){let critStage=['karatechop','slash','aircutter','razorleaf','stoneedge','blazekick','shadowclaw','crosschop','nightslash','leafblade','ivycudgel'].includes(moveId)?1:0;if(a.itemActive&&['scopelens','razorclaw'].includes(id(a.item)))critStage++;if(a.itemActive&&id(a.item)==='stick'&&a.num===83)critStage+=2;const critical=moveId!=='nightshade'&&!['battlearmor','shellarmor'].includes(id(b.ability))&&this.rng.chance(1,[16,8,4,3,2][Math.min(critStage,4)]);let amount=moveId==='nightshade'?a.level:this.calculate(s,move,{critical,roll:this.rng.int(85,101),power});const resist={occaberry:'Fire',passhoberry:'Water',rindoberry:'Grass',payapaberry:'Psychic',wacanberry:'Electric',cobaberry:'Flying',shucaberry:'Ground',yacheberry:'Ice'};if(moveId!=='nightshade'&&b.itemActive&&resist[id(b.item)]===move.type&&this.effectiveness(move.type,b)>1){this.item(b,1-s);b.itemActive=false;amount=Math.max(1,Math.floor(amount/2))}if(critical)this.emit('critical','击中了要害！',s);const dealt=this.damage(1-s,amount,'攻击',true,s,move);total+=dealt;landed++;if(['megadrain','gigadrain','drainpunch'].includes(moveId)&&a.hp&&dealt)this.restore(s,Math.max(1,Math.floor(Math.max(1,Math.floor(dealt/2))*(a.itemActive&&id(a.item)==='bigroot'?1.3:1))),moveName(moveId));if(b.hp&&((id(b.ability)==='justified'&&move.type==='Dark')||(id(b.ability)==='thermalexchange'&&move.type==='Fire'))){this.ability(b,1-s);this.boost(1-s,'atk',1)}if(dealt&&contactMoves.has(moveId)&&a.hp)this.contact(s,1-s);if(moveId==='twineedle'&&b.hp&&id(b.ability)!=='shielddust'&&this.secondary(s,20))this.setStatus(1-s,'psn',s,false,{silentFailure:true})}
 if(b.vol.sashUsed){this.item(b,1-s);b.itemActive=false;this.emit('endure',`${b.name}靠气势披带坚持住了！`,1-s)}delete b.vol.sashMove;delete b.vol.sashUsed;const eff=this.effectiveness(move.type,b);if(total&&moveId!=='nightshade'){if(eff>1)this.emit('effective','效果绝佳！',s);else if(eff<1)this.emit('resisted','效果不太好。',s)}if(hits>1)this.emit('multihit',`连续命中了 ${landed} 次。`,s);
 if(moveId==='takedown'&&a.hp&&total&&id(a.ability)!=='rockhead')this.damage(s,Math.max(1,Math.floor(total/4)),'猛撞反作用',false);if(['bravebird','woodhammer','flareblitz'].includes(moveId)&&a.hp&&total&&id(a.ability)!=='rockhead')this.damage(s,Math.max(1,Math.round(total/3)),moveName(moveId)+'反作用',false);if(moveId==='struggle'&&a.hp)this.damage(s,Math.max(1,Math.floor(a.maxhp/4)),'挣扎反作用',false);
 if(moveId==='knockoff'&&b.itemActive){if(id(b.ability)==='stickyhold'&&b.hp)this.ability(b,1-s);else{b.itemActive=false;b.itemLost=true;b.revealedItem=true;this.emit('knockoff',`${b.name}的${b.itemZh}被拍落了！`,1-s)}}
 if(['bugbite','pluck'].includes(moveId)&&a.hp&&b.itemActive&&id(b.item).endsWith('berry')&&!(b.hp&&id(b.ability)==='stickyhold')){b.itemActive=false;b.revealedItem=true;this.emit('eat',`${a.name}吃掉了对手的${b.itemZh}！`,s,{item:id(b.item)});this.consumeBerry(s,id(b.item),true)}
 if(moveId==='rapidspin'&&total&&a.hp){delete a.vol.seed;delete a.vol.wrap;for(const key of ['stealthrock','spikes','toxicspikes'])delete this.sides[s].conditions[key];this.emit('field',`${a.name}清除了己方的陷阱和束缚！`,s)}
 if(b.hp){if((move.type==='Fire'||moveId==='scald')&&b.status==='frz'){b.status='';this.emit('cure',`${b.name}解冻了。`,1-s)}if(moveId==='wakeupslap'&&b.status==='slp'){b.status='';b.sleep=0;this.emit('cure',`${b.name}醒来了。`,1-s)}const st={flareblitz:['brn',10],scald:['brn',30],sludgewave:['psn',10],poisonjab:['psn',30],thunderbolt:['par',10],flamethrower:['brn',10],sludgebomb:['psn',30],blazekick:['brn',10],discharge:['par',30],icepunch:['frz',10],icefang:['frz',10],heatwave:['brn',10],icebeam:['frz',10],gunkshot:['psn',30],firepunch:['brn',10],thunderpunch:['par',10],thunderfang:['par',10],spark:['par',30],sludge:['psn',30],dragonbreath:['par',30],firefang:['brn',10],ember:['brn',10],flamewheel:['brn',10],poisonfang:['tox',30],thundershock:['par',10]};if(id(b.ability)!=='shielddust'&&st[moveId]&&this.secondary(s,st[moveId][1]))this.setStatus(1-s,st[moveId][0],s,false,{silentFailure:true});const cf={signalbeam:10,psybeam:10,confusion:10,waterpulse:20};if(id(b.ability)!=='shielddust'&&cf[moveId]&&this.secondary(s,cf[moveId]))this.confuse(1-s,s,{silentFailure:true});const fl={darkpulse:20,zenheadbutt:20,extrasensory:10,icefang:10,waterfall:20,airslash:30,boneclub:10,headbutt:30,ironhead:30,twister:20,thunderfang:10,bite:30,firefang:10,stomp:30,fakeout:100,rockslide:30};const tryFlinch=(chance,itemEffect=false)=>{if(id(b.ability)!=='shielddust'&&chance&&(itemEffect?this.rng.chance(chance):this.secondary(s,chance))&&!b.vol.moved&&id(b.ability)!=='innerfocus')b.vol.flinch=true};tryFlinch(fl[moveId]);if(a.itemActive&&((id(a.item)==='kingsrock'&&move.kingsRockEligible)||(id(a.item)==='razorfang'&&move.razorFangEligible)))tryFlinch(10,true);const down={earthpower:['spd',10],bugbuzz:['spd',10],moonblast:['spa',30],playrough:['atk',10],focusblast:['spd',10],energyball:['spd',10],crunch:['def',20],psychic:['spd',10],flashcannon:['spd',10],shadowball:['spd',20],aurorabeam:['atk',10],icywind:['spe',100],mudshot:['spe',100],mudslap:['accuracy',100],acid:['spd',10],bubblebeam:['spe',10],mirrorshot:['accuracy',30],rocktomb:['spe',100]};if(id(b.ability)!=='shielddust'&&down[moveId]&&this.secondary(s,down[moveId][1]))this.boost(1-s,down[moveId][0],-1,s);if(moveId==='wrap'&&!b.vol.wrap){b.vol.wrap={left:this.rng.int(3,7),source:s,sourceKey:a.key};this.emit('trap',`${b.name}被紧紧缠住了！`,1-s)}}
 if(a.hp&&moveId==='metalclaw'&&this.secondary(s,10))this.boost(s,'atk',1);if(a.hp&&moveId==='steelwing'&&this.secondary(s,10))this.boost(s,'def',1);if(a.hp&&['silverwind','ancientpower','ominouswind'].includes(moveId)&&this.secondary(s,10))for(const st of ['atk','def','spa','spd','spe'])this.boost(s,st,1);
 if(a.hp&&total){if(moveId==='torchsong')this.boost(s,'spa',1);if(moveId==='closecombat'){this.boost(s,'def',-1,s,true);this.boost(s,'spd',-1,s,true);this.checkHerb(s)}if(moveId==='chargebeam'&&this.secondary(s,70))this.boost(s,'spa',1);if(['leafstorm','overheat','dracometeor'].includes(moveId))this.boost(s,'spa',-2);if(moveId==='superpower'){this.boost(s,'atk',-1,s,true);this.boost(s,'def',-1,s,true);this.checkHerb(s)}if(a.itemActive&&id(a.item)==='shellbell'){a.revealedItem=true;this.restore(s,Math.max(1,Math.floor(total/8)),'贝壳之铃')}if(a.itemActive&&id(a.item)==='lifeorb'){a.revealedItem=true;this.damage(s,Math.max(1,Math.floor(a.maxhp/10)),'生命宝珠',false)}}
 }
 contact(attackerSide,defenderSide){const a=this.mon(attackerSide),b=this.mon(defenderSide),ability=id(b.ability);if(!a.hp)return;
  if(ability==='roughskin'){this.ability(b,defenderSide);this.damage(attackerSide,Math.max(1,Math.floor(a.maxhp/8)),'粗糙皮肤',false)}
  const status={flamebody:'brn',static:'par',poisonpoint:'psn'}[ability];
  if((status||ability==='effectspore')&&this.rng.chance(30))this.setStatus(attackerSide,status||['slp','par','psn'][this.rng.int(0,3)],defenderSide,false,{silentFailure:true,bypassSafeguard:true,onApplied:()=>this.ability(b,defenderSide)});
 }
 switch(s,index,forced=false){const side=this.sides[s],old=this.mon(s);if(!this.switchable(s).includes(index)||(!forced&&!this.canSwitch(s)))return false;if(!forced){side.lastSwitchTurn=this.turn;side.previousActive=side.active}if(old.hp&&old.status&&id(old.ability)==='naturalcure'){this.ability(old,s);old.status='';old.sleep=0;old.toxic=0;this.emit('cure',`${old.name}通过自然回复恢复了异常状态。`,s)}old.types=M.species[id(old.species)].types.slice();old.vol={};old.boosts={atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0};old.toxic=0;old.lastMove='';old.lastReceived='';const opposing=this.mon(1-s);if(opposing.vol.wrap?.source===s)delete opposing.vol.wrap;side.active=index;this.enter(s);return true}
 residual(){const order=this.speedOrder();
 // Gen IV weather effects precede held items and ordinary residual effects.
 for(const s of order){const m=this.mon(s);if(!m.hp)continue;
  if(this.weather==='sandstorm'&&!m.types.some(t=>['Rock','Ground','Steel'].includes(t))&&!['sandveil','sandforce'].includes(id(m.ability))&&!m.vol.dig){this.damage(s,Math.max(1,Math.floor(m.maxhp/16)),'沙暴',false);if(this.checkResult())return}
  if(m.status&&this.weather==='rain'&&id(m.ability)==='hydration'){this.ability(m,s);m.status='';m.sleep=0;m.toxic=0;this.emit('cure',`${m.name}通过湿润之躯恢复了异常状态。`,s)}
 }
 for(const s of order){const m=this.mon(s);if(!m.hp)continue;
  if(m.status&&id(m.ability)==='shedskin'&&this.rng.chance(33)){this.ability(m,s);m.status='';m.sleep=0;m.toxic=0;this.emit('cure',`${m.name}蜕皮治愈了异常状态。`,s)}
  if(m.itemActive&&id(m.item)==='leftovers'){m.revealedItem=true;this.restore(s,Math.max(1,Math.floor(m.maxhp/16)),'吃剩的东西')}
  if(m.itemActive&&id(m.item)==='blacksludge'){m.revealedItem=true;if(m.types.includes('Poison'))this.restore(s,Math.max(1,Math.floor(m.maxhp/16)),'黑色污泥');else this.damage(s,Math.max(1,Math.floor(m.maxhp/8)),'黑色污泥',false);if(this.checkResult())return}
  if(!m.hp)continue;
  if(m.vol.seed!==undefined){const got=this.damage(s,Math.max(1,Math.floor(m.maxhp/8)),'寄生种子',false);if(got){const target=this.mon(m.vol.seed);this.restore(m.vol.seed,Math.floor(got*(target.itemActive&&id(target.item)==='bigroot'?1.3:1)),'寄生种子')}if(this.checkResult())return}
  if(!m.hp)continue;
  if(m.status==='psn'||m.status==='brn')this.damage(s,Math.max(1,Math.floor(m.maxhp/8)),statusZh[m.status],false);else if(m.status==='tox'){m.toxic=Math.min(15,m.toxic+1);this.damage(s,Math.max(1,Math.floor(m.maxhp/16)*m.toxic),'剧毒',false)}if(this.checkResult())return;
  if(m.hp&&m.vol.wrap){const source=this.mon(m.vol.wrap.source);if(!source.hp||source.key!==m.vol.wrap.sourceKey)delete m.vol.wrap;else{this.damage(s,Math.max(1,Math.floor(m.maxhp/16)),'紧束',false);if(--m.vol.wrap.left<=0){delete m.vol.wrap;this.emit('release',`${m.name}挣脱了紧束。`,s)}}if(this.checkResult())return}
  if(m.hp&&m.status==='slp'&&this.mon(1-s).hp&&id(this.mon(1-s).ability)==='baddreams'){this.ability(this.mon(1-s),1-s);this.damage(s,Math.floor(m.maxhp/8),'梦魇',false);if(this.checkResult())return}
  if(!m.hp)continue;
  for(const key of ['disable','encore'])if(m.vol[key]&&--m.vol[key].left<=0){delete m.vol[key];this.emit('end',`${m.name}的${key==='disable'?'定身法':'再来一次'}效果结束了。`,s)}
  if(m.vol.yawn&&--m.vol.yawn===0){delete m.vol.yawn;this.setStatus(s,'slp',1-s,false,{bypassSafeguard:true})}m.activeTurns++;
 }
 for(const side of this.sides)for(const key of Object.keys(side.conditions))if(side.conditions[key]>0&&--side.conditions[key]===0)delete side.conditions[key];for(const side of this.sides)for(const m of side.team)if(m.vol.roost){m.types=m.vol.roost;delete m.vol.roost}if(this.weather&&this.weatherLeft>0&&--this.weatherLeft<=0){this.weather='';this.emit('weather','天气恢复了正常。')}if(this.terrain&&--this.terrainLeft<=0){this.terrain='';this.emit('field','电气场地结束了。')}this.refreshFieldAbilities();
 }
 checkResult(){if(this.phase==='win'||this.phase==='loss')return true;const alive=this.sides.map(s=>s.team.some(m=>m.hp>0));if(!alive[0]||!alive[1]){this.phase=!alive[0]?'loss':'win';this.emit('battle_end',this.phase==='win'?'你赢得了这场对战！':!alive[1]?'双方均失去战斗能力，本轮挑战结束。':'你的队伍失去了战斗能力。',null,{result:this.phase});return true}return false}
 replaceFainted(){if(this.checkResult())return;for(let guard=0;guard<3&&!this.mon(1).hp;guard++){const choices=this.switchable(1);if(!choices.length)break;this.switch(1,this.aiReplacement(1),true)}if(this.checkResult())return;this.phase=this.mon(0).hp?'battle':'forced';if(this.phase==='forced')this.emit('force','请选择下一只出战的宝可梦。',0)}
 // AI gets a public estimate of the opponent, never their actual four moves,
 // EVs, nature, unrevealed ability/item, or any pending action. HP is the bar
 // fraction applied to a neutral, evenly invested species estimate.
 aiPublicMon(s){
  const m=this.mon(s),spec=M.species[id(m.species)],values={};
  for(const k of stats){const n=Math.floor((2*spec.baseStats[k]+31+20)*m.level/100);values[k]=k==='hp'?n+m.level+10:n+5}
  const vol={};
  for(const k of ['foresight','flashfire','minimize','seed','paradox','watersport','mudsport'])if(m.vol[k]!==undefined)vol[k]=clone(m.vol[k]);
  if(m.vol.dig)vol.dig={index:-1};
  if(m.vol.confusion)vol.confusion=1;
  if(m.vol.yawn)vol.yawn=1;
  if(m.vol.disable)vol.disable={id:m.vol.disable.id};
  if(m.vol.encore)vol.encore={id:m.vol.encore.id};
  return {num:m.num,species:m.species,level:m.level,types:m.types.slice(),weight:spec.weight,stats:values,maxhp:values.hp,hp:m.hp>0?Math.max(1,Math.round(values.hp*m.hp/m.maxhp)):0,status:m.status,boosts:{...m.boosts},vol,ability:m.revealedAbility?m.ability:'',item:m.revealedItem?m.item:'',itemActive:m.revealedItem&&m.itemActive,seen:m.seen.slice(),lastMove:m.lastMove,activeTurns:m.activeTurns};
 }
 aiThreats(foe){
  const threats=[];
  for(const key of foe.seen.slice(-8)){const move=M.moves[key];if(move&&move.category!=='Status'&&!(key==='fakeout'&&foe.activeTurns>0))threats.push({move,weight:key===foe.lastMove?1.35:1})}
  // Unseen coverage is not read from the rental. Only generic 70-power STAB
  // estimates derived from public typing are allowed, at lower confidence.
  if(foe.seen.length<4){for(const type of foe.types){for(const category of ['Physical','Special']){
   const stat=category==='Physical'?'atk':'spa';
   if(foe.stats[stat]<Math.max(foe.stats.atk,foe.stats.spa)*.7)continue;
   if(!threats.some(t=>t.move.type===type&&t.move.category===category))threats.push({move:{id:'estimatedstab',type,category,power:70,accuracy:100,priority:0},weight:.55});
  }}}
  return threats;
 }
 aiDamage(s,move,a,b){
  if(move.category==='Status'||!a.hp||!b.hp)return 0;
  const ability=id(b.ability);
  if((move.type==='Grass'&&ability==='sapsipper')||(move.type==='Ground'&&ability==='levitate')||(move.type==='Fire'&&ability==='flashfire'&&b.status!=='frz')||(move.type==='Water'&&ability==='waterabsorb')||(move.type==='Electric'&&['voltabsorb','motordrive'].includes(ability))||(soundMoves.has(move.id)&&ability==='soundproof'))return 0;
  if(move.id==='fakeout'&&a.activeTurns>0)return 0;
  if(b.vol.dig&&!['magnitude','earthquake'].includes(move.id))return 0;
  // Last turn's damaged/attackedBy flags do not predict the next action.
  const av={...a,vol:{...a.vol}},bv={...b,vol:{...b.vol}};
  delete av.vol.attackedBy;delete bv.vol.damaged;
  let damage=move.id==='nightshade'?(this.effectiveness(move.type,b)?a.level:0):this.calculate(s,move,{attacker:av,target:bv,roll:92,power:move.id==='magnitude'?71:null});
  if(['doublekick','twineedle'].includes(move.id))damage*=2;
  if(['bulletseed','rockblast','doubleslap'].includes(move.id))damage*=3;
  if(move.id==='dig'&&!a.vol.dig)damage*=.55;
  let accuracy=move.accuracy===true?1:move.accuracy/100*stage(a.boosts.accuracy,true)/stage(move.id==='sacredsword'?0:b.vol.foresight?Math.min(0,b.boosts.evasion):b.boosts.evasion,true);
  if(move.accuracy!==true){if(id(a.ability)==='compoundeyes')accuracy*=1.3;if(id(a.ability)==='victorystar')accuracy*=1.1;if(b.itemActive&&id(b.item)==='brightpowder')accuracy*=.9;if(this.weather==='sandstorm'&&ability==='sandveil')accuracy*=.8}
  damage*=Math.min(1,accuracy);
  if(a.status==='slp')damage*=.35;
  if(a.status==='frz'&&!['flamewheel','flareblitz','scald'].includes(move.id))damage*=.2;
  if(a.status==='par'&&id(a.ability)!=='magicguard')damage*=.75;
  return damage;
 }
 aiIncoming(s,mon,foe,threats){
  let worst=0,total=0,weight=0;
  for(const t of threats){const n=this.aiDamage(1-s,t.move,foe,mon);worst=Math.max(worst,n*Math.min(1,t.weight));total+=n*t.weight;weight+=t.weight}
  return weight?worst*.7+total/weight*.3:0;
 }
 aiFirst(s,mon,foe,move,threats){
  let priority=0;for(const t of threats)priority=Math.max(priority,t.move.priority||0);
  return move.priority>priority||(move.priority===priority&&this.speed(s,mon)>this.speed(1-s,foe));
 }
 aiStatusScore(s,m,a,b,incoming,threats){
  const risk=incoming/Math.max(1,a.hp),ability=id(b.ability),safeguard=this.sides[1-s].conditions.safeguard;
  let score=-6;
  if(['moonlight','recover','roost'].includes(m.id)){
   const healed=Math.min(a.maxhp-a.hp,a.maxhp*.5),faster=this.speed(s,a)>this.speed(1-s,b);
   score=healed/a.maxhp*95-(healed<a.maxhp*.2?20:0)-(risk>=1&&!faster?90:0);
  }else if(['calmmind','dragondance','quiverdance'].includes(m.id)){
   const stat=m.id==='dragondance'?'atk':'spa',category=stat==='atk'?'Physical':'Special';
   score=!a.moves.some(x=>M.moves[x.id].category===category)||a.boosts[stat]>=2?-8:34-risk*45;
  }else if(statusMoves[m.id]){
   const status=statusMoves[m.id];let blocked=!!b.status||!!safeguard;
   if(['psn','tox'].includes(status)&&b.types.some(t=>['Poison','Steel'].includes(t)))blocked=true;
   if(status==='brn'&&(b.types.includes('Fire')||['waterveil','thermalexchange'].includes(ability)))blocked=true;
   if(status==='slp'&&(ability==='insomnia'||this.terrain==='electric'&&this.grounded(b)))blocked=true;
   if(m.id==='thunderwave'&&(this.effectiveness('Electric',b)===0||['voltabsorb','motordrive'].includes(ability)))blocked=true;
   if(soundMoves.has(m.id)&&ability==='soundproof')blocked=true;
   score=blocked?-10:status==='slp'?38:status==='brn'?(b.stats.atk>=b.stats.spa?32:18):status==='par'?30:27;
  }else if(m.id==='leechseed')score=b.vol.seed!==undefined||b.types.includes('Grass')||ability==='sapsipper'?-10:30;
  else if(confusionMoves.has(m.id))score=b.vol.confusion||safeguard||ability==='owntempo'?-8:18;
  else if(['protect','detect'].includes(m.id))score=a.vol.protectChain?-12:b.status||b.vol.seed!==undefined?26:a.itemActive&&id(a.item)==='leftovers'&&a.hp<a.maxhp?16:2;
  else if(boosts[m.id]){
   const [stat,n]=boosts[m.id],target=n>0?a:b;
   const useful=stat==='atk'?a.moves.some(x=>M.moves[x.id].category==='Physical'):stat==='spa'?a.moves.some(x=>M.moves[x.id].category==='Special'):true;
   score=Math.abs(target.boosts[stat])>=2||n>0&&!useful?-8:n>0?30-risk*40:20;
  }else if(['assist','mirrormove'].includes(m.id))score=14;
  else if(['reflect','lightscreen','tailwind','safeguard'].includes(m.id))score=this.sides[s].conditions[m.id]?-8:25;
  else if(m.id==='yawn')score=b.status||b.vol.yawn||safeguard||ability==='insomnia'||this.terrain==='electric'&&this.grounded(b)?-8:30;
  else if(m.id==='encore')score=b.lastMove&&M.moves[b.lastMove]?.category==='Status'&&!b.vol.encore?34:-8;
  else if(m.id==='disable')score=b.lastMove&&!b.vol.disable?24:-8;
  else if(m.id==='stealthrock')score=this.sides[1-s].conditions.stealthrock?-8:28;
  else if(weatherMoves.has(m.id)){
   const terrain=m.id==='electricterrain',active=terrain?this.terrain==='electric':this.weather===({sunnyday:'sun',raindance:'rain',sandstorm:'sandstorm'})[m.id];
   const benefits=(terrain&&id(a.ability)==='quarkdrive')||(m.id==='sunnyday'&&['protosynthesis','chlorophyll'].includes(id(a.ability)))||(m.id==='raindance'&&id(a.ability)==='swiftswim');
   score=active?-8:benefits?34:10;
  }else if(m.id==='spite')score=b.lastMove?8:-8;
  else if(m.id==='swagger')score=b.vol.confusion||safeguard?-8:12;
  else if(m.id==='tickle')score=b.boosts.def<=-2?-8:16;
  else if(m.id==='acupressure')score=a.activeTurns<3?20-risk*30:-5;
  if(risk>=1&&!this.aiFirst(s,a,b,m,threats))score-=60;
  if(a.status==='slp'||a.status==='frz')score-=35;
  if(m.accuracy!==true&&score>0)score*=m.accuracy/100;
  return score;
 }
 aiEvaluate(s,a,b,threats,entering=false){
  const legal=entering?a.moves.map((m,index)=>({...m,index})).filter(m=>m.pp>0):this.choices(s);
  const incoming=this.aiIncoming(s,a,b,threats),scored=[];
  let bestDamage=0,canFinish=false;
  for(const slot of legal){const m=M.moves[slot.id];let score;
   if(m.category==='Status')score=this.aiStatusScore(s,m,a,b,incoming,threats);
   else{
    const damage=this.aiDamage(s,m,a,b),first=this.aiFirst(s,a,b,m,threats);
    bestDamage=Math.max(bestDamage,damage);
    const ko=damage>=b.hp&&b.hp>0;
    if(ko&&first)canFinish=true;
    score=100*Math.min(damage,b.hp)/Math.max(1,b.maxhp)+(ko?(first?48:14):0);
    if(damage<=0)score=-12;
    if(incoming>=a.hp&&!first)score-=32;
    if(['megadrain','gigadrain','drainpunch'].includes(m.id))score+=Math.min(a.maxhp-a.hp,damage*.5)/a.maxhp*35;
    if(['doubleedge','flareblitz','bravebird','woodhammer'].includes(m.id)&&damage/3>=a.hp&&!ko)score-=20;
   }
   scored.push({action:{kind:'move',index:slot.index},score});
  }
  if(!scored.length){const damage=this.aiDamage(s,M.moves.struggle,a,b);scored.push({action:{kind:'move',index:-1},score:damage/Math.max(1,b.maxhp)*70-25})}
  scored.sort((x,y)=>y.score-x.score);
  const residual=id(a.ability)==='magicguard'?0:(a.vol.seed!==undefined?.125:0)+(a.status==='tox'?Math.min(.5,(a.toxic+1)/16):['psn','brn'].includes(a.status)?.125:0);
  const position=scored[0].score-incoming/a.maxhp*(canFinish?12:65)+a.hp/a.maxhp*12-residual*65-(incoming>=a.hp&&!canFinish?30:0);
  return {scored,incoming,position,bestDamage,canFinish};
 }
 aiEntry(s,m){
  const mon={...m,types:M.species[id(m.species)].types.slice(),vol:{},boosts:{atk:0,def:0,spa:0,spd:0,spe:0,accuracy:0,evasion:0},activeTurns:0,toxic:0};
  const hazard=this.sides[s].conditions.stealthrock&&id(m.ability)!=='magicguard'?Math.max(1,Math.floor(m.maxhp*this.effectiveness('Rock',mon)/8)):0;
  mon.hp=Math.max(0,m.hp-hazard);return {mon,hazard};
 }
 aiReplacement(s){
  const b=this.aiPublicMon(1-s),threats=this.aiThreats(b),options=this.switchable(s);
  let best=options[0],score=-100000;
  for(const i of options){const entry=this.aiEntry(s,this.sides[s].team[i]);
   const value=!entry.mon.hp?-10000-entry.hazard:b.hp?this.aiEvaluate(s,entry.mon,b,threats,true).position-entry.hazard/entry.mon.maxhp*100:entry.mon.hp/entry.mon.maxhp*100;
   if(value>score){best=i;score=value}
  }return best;
 }
 chooseAI(s){
  const side=this.sides[s],a=this.mon(s),b=this.aiPublicMon(1-s),threats=this.aiThreats(b),stay=this.aiEvaluate(s,a,b,threats);
  // Compare at most two living reserves. No battle-tree simulation, no reads
  // of this.actions/inputs/enemyChoice and no player command argument.
  if(this.canSwitch(s)&&!stay.canFinish){
   const cleanse=(a.vol.seed!==undefined?10:0)+(a.vol.yawn&&!a.status?22:0)+(a.status==='tox'?Math.min(24,a.toxic*6):0)+(a.status&&id(a.ability)==='naturalcure'?24:0);
   const desperate=stay.incoming>=a.hp||stay.bestDamage<b.maxhp*.12||!!a.vol.yawn;
   const recent=this.turn-(side.lastSwitchTurn??-99)<=1;
   let best=null;
   for(const i of this.switchable(s)){
    const entry=this.aiEntry(s,side.team[i]);if(!entry.mon.hp)continue;
    const evaluation=this.aiEvaluate(s,entry.mon,b,threats,true);
    // A switch gives the opponent a free hit; a fragile counter is not a safe
    // replacement. Hazards and repeated pivoting are charged explicitly.
    if(evaluation.incoming>=entry.mon.hp*.9)continue;
    const returnPenalty=recent&&side.previousActive===i?18:0;
    const score=evaluation.position-evaluation.incoming/entry.mon.maxhp*45-entry.hazard/entry.mon.maxhp*100-12-returnPenalty+cleanse;
    if(!best||score>best.score)best={index:i,score};
   }
   const margin=12+(recent&&!desperate?18:0);
   if(best&&best.score>stay.position+margin)return{kind:'switch',index:best.index};
  }
  // Small variation among similarly useful moves; never randomize a switch
  // into a bad matchup just to meet a switching-frequency quota.
  const best=stay.scored[0].score,close=stay.scored.filter(x=>x.score>=best-5);
  return close[this.aiRng.int(0,close.length)].action;
 }

 act(action){this.events=[];if(!['battle','forced'].includes(this.phase))return{ok:false,error:'战斗已经结束。'};if(this.phase==='forced'){if(action.kind!=='switch'||!this.switchable(0).includes(action.index))return{ok:false,error:'请选择可出战的替补。'};this.inputs.push({turn:this.turn,forced:true,player:clone(action)});this.switch(0,action.index,true);this.replaceFainted();this.enemyChoice=this.chooseAI(1);return{ok:true,events:clone(this.events)}}
 if(action.kind==='switch'){if(!this.canSwitch(0)||!this.switchable(0).includes(action.index))return{ok:false,error:'现在不能换到这只宝可梦。'}}else if(action.kind==='move'){const usable=this.choices(0);if(action.index===-1?usable.length>0:!usable.some(x=>x.index===action.index))return{ok:false,error:'该招式现在无法使用。'}}else return{ok:false,error:'无效指令。'};
 const other=clone(this.enemyChoice);this.inputs.push({turn:this.turn,forced:false,player:clone(action),enemy:clone(other)});this.actions.push({turn:this.turn,player:clone(action),enemy:clone(other)});for(const s of [0,1]){const m=this.mon(s);delete m.vol.flinch;delete m.vol.protect;delete m.vol.damaged;delete m.vol.attackedBy;delete m.vol.moved}this.emit('turn',`第 ${this.turn} 回合`);
 const order=[action,other].map((act,s)=>({s,act,actor:this.mon(s),priority:act.kind==='switch'?6:act.index===-1?0:M.moves[this.mon(s).moves[act.index].id].priority,speed:this.speed(s)}));if(order[1].priority>order[0].priority||(order[1].priority===order[0].priority&&(order[1].speed>order[0].speed||(order[1].speed===order[0].speed&&this.rng.chance(50)))))order.reverse();
 for(const entry of order){if(this.mon(entry.s)!==entry.actor||!entry.actor.hp)continue;if(entry.act.kind==='switch'){entry.actor.vol.moved=true;this.switch(entry.s,entry.act.index);this.mon(entry.s).vol.moved=true}else this.use(entry.s,entry.act.index===-1?'struggle':entry.actor.moves[entry.act.index].id);if(this.checkResult())break}
 if(this.phase!=='win'&&this.phase!=='loss'){this.residual();this.replaceFainted();this.turn++;if(this.phase==='battle')this.enemyChoice=this.chooseAI(1)}return{ok:true,events:clone(this.events)};
 }
}
class Factory{
 records(){const rows=[];for(const match of this.history){rows.push({kind:'match',text:`第 ${match.battle} 场对战`,turn:0});for(const e of match.transcript||match.log)rows.push(e)}if(this.battle&&!this.battle.archived){rows.push({kind:'match',text:`第 ${this.wins+1} 场对战`,turn:0});for(const e of this.battle.transcript||this.battle.log)rows.push(e)}return rows}
 constructor(seed,division=1){if(division!==null&&!D.divisions.some(d=>d.id===division))throw Error('Unknown division');this.seed=seed||1;this.division=division;this.rng=new RNG(this.seed);this.phase=division===null?'division':'rental';this.selected=[];this.wins=0;this.swaps=0;this.totalTurns=0;this.team=[];this.battle=null;this.lastEnemy=[];this.candidates=division===null?[]:this.draw(6);this.opponents=Array.from({length:7},()=>[]);this.history=[]}
 chooseDivision(division){if(this.phase!=='division'||!D.divisions.some(d=>d.id===division))return false;this.division=division;this.candidates=this.draw(6);this.phase='rental';return true}
 get divisionInfo(){return D.divisions.find(d=>d.id===this.division)}
 draw(n,pool=this.division,exclude=[],target=null){
  if(pool!==this.division)throw Error('Cross-division match is forbidden');
  // Roll species first. Generate moves only for species visited by the search;
  // cache within this draw, never on a global catalogue of fixed builds.
  const options=this.rng.shuffle(D.speciesSets.filter(x=>x.pool===pool&&!exclude.some(m=>m.num===x.num))),out=[],generated=[];
  let branches=0;
  // Bounds depend only on species, so reject impossible BST branches before
  // exploring different moves/items for the exact same species combination.
  const configuredGap=this.divisionInfo.teamBSTGap;
  let budget=target!==null&&configuredGap!==null&&configuredGap!==undefined?configuredGap:null;
  const lows=[],highs=[];
  // Early-stage pools prefer similar totals; do not make an extreme legal
  // player roster impossible to match after its species have been excluded.
  if(budget!==null){
   lows[options.length]=[0,1e9,1e9,1e9,1e9,1e9,1e9];highs[options.length]=[0,-1e9,-1e9,-1e9,-1e9,-1e9,-1e9];
   for(let i=options.length-1;i>=0;i--){lows[i]=[0];highs[i]=[0];for(let k=1;k<=n;k++){lows[i][k]=Math.min(lows[i+1][k],options[i].bst+lows[i+1][k-1]);highs[i][k]=Math.max(highs[i+1][k],options[i].bst+highs[i+1][k-1]);}}
   budget=Math.max(budget,lows[0][n]-target,target-highs[0][n]);
  }
  const search=(start,total)=>{
   branches++;if(branches>4096)return false;
   const left=n-out.length;if(budget!==null&&(total+lows[start][left]>target+budget||total+highs[start][left]<target-budget))return false;
   if(!left)return true;
   for(let i=start;i<=options.length-left;i++){
    if(branches>4096)return false;
    if(budget!==null&&(total+options[i].bst+lows[i+1][left-1]>target+budget||total+options[i].bst+highs[i+1][left-1]<target-budget))continue;
    const tried=[];
    if(!generated[i])generated[i]=[];
    for(let attempt=0;attempt<3;attempt++){
     if(!generated[i][attempt])generated[i][attempt]=G.generate(options[i],this.rng);
     const set=generated[i][attempt];
     for(const gear of set.itemOptions){
      const key=id(gear.item);if(tried.includes(key)||out.some(x=>id(x.item)===key)||exclude.some(x=>id(x.item)===key))continue;tried.push(key);
      out.push({...set,item:gear.item,itemZh:gear.itemZh});if(search(i+1,total+set.bst))return true;out.pop();
     }
    }
   }
   return false;
  };
  let found=search(0,0);
  // Remain in the selected evolution tier even when shared-item constraints
  // prevent a close-total match. Never fall back to a different division.
  if(!found&&budget!==null){budget=null;branches=0;found=search(0,0)}
  if(!found)throw Error('No legal team within division');return out.map(createMon)
 }
 nextOpponent(){this.opponents[this.wins]=this.draw(3,this.division,this.team,this.team.reduce((sum,m)=>sum+m.bst,0))}
 select(index){if(this.phase!=='rental'||index<0||index>=this.candidates.length)return false;const p=this.selected.indexOf(index);if(p>=0)this.selected.splice(p,1);else if(this.selected.length<3)this.selected.push(index);else return false;return true}
 lock(){if(this.phase!=='rental'||this.selected.length!==3)return false;this.team=this.selected.map(i=>clone(this.candidates[i]));this.nextOpponent();this.phase='intel';return true}
 begin(){if(this.phase!=='intel')return false;this.battle=new Battle(this.team,this.opponents[this.wins],this.seed+this.wins*7919+53);this.phase='battle';return true}
 act(action){if(this.phase!=='battle')return{ok:false,error:'当前不在对战中。'};const result=this.battle.act(action);if(!result.ok)return result;if(['win','loss'].includes(this.battle.phase)){this.totalTurns+=this.battle.actions.length;this.history.push({division:this.division,battle:this.wins+1,seed:this.seed+this.wins*7919+53,team:clone(this.team),enemy:clone(this.opponents[this.wins]),inputs:clone(this.battle.inputs),result:this.battle.phase,actions:clone(this.battle.actions),log:clone(this.battle.log),transcript:clone(this.battle.transcript)});this.battle.archived=true;if(this.battle.phase==='loss'){this.phase='loss';this.team=clone(this.battle.sides[0].team)}else{this.wins++;this.team=clone(this.battle.sides[0].team).map(heal);this.lastEnemy=clone(this.battle.sides[1].team);this.phase=this.wins===7?'win':'swap'}}return result}
 exchange(own=-1,foe=-1){if(this.phase!=='swap')return false;if(own!==-1||foe!==-1){if(!Number.isInteger(own)||!Number.isInteger(foe)||own<0||own>2||foe<0||foe>2)return false;const next=this.lastEnemy[foe];if(!next||next.pool!==this.division||this.team.some((m,i)=>i!==own&&(m.num===next.num||id(m.item)===id(next.item))))return false;this.team[own]=heal(clone(next));this.swaps++}this.nextOpponent();this.phase='intel';return true}
 resign(){if(!['battle','intel','swap'].includes(this.phase))return false;if(this.battle&&this.phase==='battle'){this.totalTurns+=this.battle.actions.length;this.team=clone(this.battle.sides[0].team)}this.phase='loss';return true}
}
const api={RNG,Battle,Factory,createMon,heal,stage,statusZh,moveName};root.FactoryEngine=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
