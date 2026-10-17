/* Presentation only: deterministic particles, no battle RNG or state writes. */
(function(root){
'use strict';
const media=matchMedia('(prefers-reduced-motion: reduce)');let override=null;
const api={get enabled(){return override??!media.matches},setEnabled(v){override=!!v},source(num,back=false){
  const view=back?'back':'front';
  return `assets/pixel/${api.enabled?'':'still-'}${view}/${num}.png`;
}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const sprite=s=>document.querySelector(`.battle-sprite.${s===0?'player':'foe'}`);
const self=new Set(['withdraw','protect','detect','agility','doubleteam','followme','moonlight','recover','roost','watersport','mudsport','barrier','defensecurl','swordsdance','acupressure','acidarmor','minimize','grudge','reflect','lightscreen','mist','tailwind','sunnyday','electricterrain','raindance','sandstorm','safeguard','amnesia','quiverdance','calmmind','dragondance','harden','howl','irondefense']);
const groups={
 flame:'firefang ember flamewheel willowisp',water:'aquajet watergun waterpulse bubblebeam watersport',electric:'thundershock thunderwave shockwave',
 leaf:'magicalleaf razorleaf leechseed grassknot',poison:'toxic poisonfang poisonpowder acid',powder:'stunspore sweetscent silverwind',
 slash:'metalclaw scratch slash aerialace karatechop wingattack aircutter',bite:'bite bugbite twineedle vicegrip',
 impact:'quickattack doublekick doubleslap strength stomp fakeout facade wakeupslap assurance feintattack knockoff struggle',
 rock:'rocktomb rockblast rockslide stealthrock magnitude sandattack',ice:'iceshard',star:'swift mirrorshot moonblast dazzlinggleam playrough',ghost:'nightshade shadowsneak grudge',
 psychic:'psybeam confusion confuseray',sound:'sing supersonic roar metalsound screech',shield:'protect barrier reflect lightscreen mist',
 heal:'moonlight recover roost',boost:'withdraw agility doubleteam defensecurl swordsdance acupressure acidarmor minimize amnesia calmmind quiverdance dragondance harden howl irondefense',
 debuff:'smokescreen scaryface featherdance flatter tailwhip leer disable encore foresight yawn',vine:'wrap',wind:'tailwind',weather:'raindance sandstorm sunnyday electricterrain',dig:'dig',copy:'assist mirrormove followme'
};
const styles={flame:['#ffb544','#ff633d'],water:['#8df1ff','#388edc'],electric:['#ffed65','#fff8d0'],leaf:['#a8e86e','#428d42'],poison:['#d7a0ed','#9c56b5'],powder:['#eced94','#a9c96e'],slash:['#f3faf9','#9bbfce'],bite:['#fff5d5','#d57d76'],impact:['#fff4b9','#d59b60'],rock:['#e5cb92','#8e7159'],ice:['#d9fbff','#69cbe1'],ghost:['#c19be8','#735ba9'],psychic:['#e9a9ec','#a875e1'],sound:['#e5f2ff','#9cbded'],shield:['#c2f5ed','#5fbcbd'],heal:['#d6ffbd','#79cd83'],boost:['#fff4aa','#e6a85d'],debuff:['#c1a6e1','#8c75b3'],wind:['#edfbea','#8fc9a5'],weather:['#bcd7e6','#719bb8'],dig:['#d7bc86','#927d58'],copy:['#f4df9c','#ab9bdf']};
const typeFamilies={Fire:'flame',Water:'water',Electric:'electric',Grass:'leaf',Poison:'poison',Ice:'ice',Ghost:'ghost',Psychic:'psychic',Dark:'ghost',Dragon:'dragon',Rock:'rock',Ground:'rock',Flying:'wind',Steel:'slash',Bug:'powder',Fairy:'star',Fighting:'impact',Normal:'impact'};
function family(id){const field={sunnyday:'sun',sandstorm:'sand',electricterrain:'terrain'};if(field[id])return field[id];const explicit=Object.keys(groups).find(k=>groups[k].split(' ').includes(id));if(explicit)return explicit;const m=root.FactoryMeta.moves[id];return m?.category==='Status'?'debuff':typeFamilies[m?.type]||'impact'}
api.family=family;
styles.dragon=['#b8a9ff','#6751b6'];
function animate(el,frames,ms){if(!el||!api.enabled)return Promise.resolve();const a=el.animate(frames,{duration:ms,easing:'ease-in-out'});return a.finished.catch(()=>{}).finally(()=>a.cancel())}

function point(side,arena){const rect=arena.getBoundingClientRect(),el=sprite(side),r=el?.getBoundingClientRect(),w=Math.ceil(arena.clientWidth/3),h=Math.ceil(arena.clientHeight/3);return r?{x:(r.left+r.width*.5-rect.left)/rect.width*w,y:(r.top+r.height*.53-rect.top)/rect.height*h}:{x:w*(side?.74:.24),y:h*(side?.28:.7)}}
const recoveryDurations=Object.fromEntries(Object.entries(root.FactoryFeedbackData.durations).map(([k,v])=>[k,v*1000]));
const recoveryImages=new Map();
const recoveryName=(name,event)=>name==='item'?(root.FactoryRecoveryArt?.[event?.item]?event.item:'item_bag'):name;
async function prepareRecovery(kind,event){
 const names=new Set(root.FactoryFeedbackData.frames[kind].flat().map(row=>recoveryName(row[0],event)));
 await Promise.all([...names].map(async name=>{
  if(!recoveryImages.has(name)){const art=root.FactoryRecoveryArt?.[name];
   const rows=(art?.files||[]).map(src=>{const image=new Image();const ready=new Promise(resolve=>{image.onload=resolve;image.onerror=resolve});image.src=src;return{image,ready}});recoveryImages.set(name,rows);
  }await Promise.all(recoveryImages.get(name).map(x=>x.ready));
 }));
}
function drawRecovery(ctx,kind,t,b,w,event){
 const frames=root.FactoryFeedbackData.frames[kind],rows=frames[Math.min(frames.length-1,Math.floor(t*(frames.length-1)))],scale=w/720;
 ctx.save();ctx.imageSmoothingEnabled=false;
 for(const [name,x,y,size,phase,alpha] of rows){
  const images=recoveryImages.get(recoveryName(name,event)),row=images?.[Math.min(images.length-1,Math.floor(phase*(images.length-1)))];if(!row?.image.naturalWidth)continue;
  const image=row.image,s=size*scale/Math.max(image.naturalWidth,image.naturalHeight),iw=image.naturalWidth*s,ih=image.naturalHeight*s;
  ctx.globalAlpha=alpha;ctx.drawImage(image,Math.round(b.x+x*(event?.side===1?-1:1)*scale-iw/2),Math.round(b.y+y*scale-ih/2),Math.round(iw),Math.round(ih));
 }ctx.restore();
}
async function particles(kind,source,target,duration=750,miss=false,moveId='',progress=()=>{},event=null){
 const arena=document.querySelector('.arena');if(!arena||!api.enabled)return;await root.FactoryChoreography?.prepare?.(moveId,source,miss);
 const recovery=!moveId&&!!recoveryDurations[kind];if(recovery)await prepareRecovery(kind,event);
 const canvas=document.createElement('canvas');canvas.className='battle-fx';canvas.dataset.effect=kind;canvas.setAttribute('aria-hidden','true');canvas.width=Math.ceil(arena.clientWidth/3);canvas.height=Math.ceil(arena.clientHeight/3);arena.append(canvas);
 const ctx=canvas.getContext('2d');if(!ctx){canvas.remove();return}ctx.imageSmoothingEnabled=false;const a=point(source,arena),b=point(target,arena),[light,dark]=styles[kind]||styles.impact,w=canvas.width,h=canvas.height;if(miss){b.x+=source===0?20:-20;b.y-=12}
 const dot=(x,y,r,c)=>{ctx.fillStyle=c;ctx.fillRect(Math.round(x-r/2),Math.round(y-r/2),r,r)};
 const line=(x1,y1,x2,y2,c,width=2)=>{ctx.strokeStyle=c;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(Math.round(x1),Math.round(y1));ctx.lineTo(Math.round(x2),Math.round(y2));ctx.stroke()};
 const ring=(x,y,r,c)=>{ctx.strokeStyle=c;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,Math.max(1,r),Math.max(1,r*.7),0,0,Math.PI*2);ctx.stroke()};
 
 try{await new Promise(resolve=>{let start;function frame(now){start??=now;const t=Math.min(1,(now-start)/duration);progress(t);canvas.dataset.progress=String(Math.floor(t*100));ctx.clearRect(0,0,w,h);ctx.globalAlpha=Math.min(1,t*8,(1-t)*7);
  if(['psychic','ghost','weather'].includes(kind)){ctx.fillStyle=kind==='ghost'?'#50417625':kind==='weather'?'#48638c18':'#b477bf18';ctx.fillRect(0,0,w,h)}
  if(recovery){drawRecovery(ctx,kind,t,b,w,event);}else if(root.FactoryChoreography?.draw(ctx,moveId,source,t,a,b,w,miss)){}else if(['flame','water','leaf','poison','powder','ice','ghost','dragon','copy'].includes(kind)){
   for(let i=0;i<12;i++){const u=Math.max(0,Math.min(1,t*1.65-i*.035)),x=a.x+(b.x-a.x)*u,y=a.y+(b.y-a.y)*u+Math.sin(u*9+i)*4;
    if(u<=0||u>=1)continue;const size=kind==='flame'?5:kind==='ice'?4:3;dot(x,y,size,dark);dot(x-1,y-2,size-1,light);
    if(kind==='water')ring(x,y,3,light);if(kind==='leaf')line(x-3,y+2,x+3,y-2,dark);if(kind==='ice'){line(x-4,y,x+4,y,light);line(x,y-4,x,y+4,light)}
   }if(t>.5&&!miss)for(let i=0;i<8;i++){const ang=i*Math.PI/4,r=(t-.5)*45;dot(b.x+Math.cos(ang)*r,b.y+Math.sin(ang)*r,3,i%2?dark:light)}
  }else if(kind==='star'){
   for(let i=0;i<6;i++){const u=Math.max(0,Math.min(1,t*1.7-i*.08));if(u<=0||u>=1)continue;const x=a.x+(b.x-a.x)*u,y=a.y+(b.y-a.y)*u+Math.sin(i*2)*6;ctx.fillStyle='#fff4a6';ctx.beginPath();for(let j=0;j<10;j++){const angle=j*Math.PI/5+t*4,r=j%2?2:5;const xx=x+Math.cos(angle)*r,yy=y+Math.sin(angle)*r;if(j===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy)}ctx.closePath();ctx.fill()}
  }else if(kind==='electric'){
   for(let bolt=0;bolt<3;bolt++){let x=a.x,y=a.y;for(let j=1;j<=9;j++){const nx=a.x+(b.x-a.x)*j/9,ny=a.y+(b.y-a.y)*j/9+Math.sin(j*7+Math.floor(t*15)+bolt)*8;line(x,y,nx,ny,bolt===0?dark:light,bolt===0?4:1);x=nx;y=ny}}
  }else if(kind==='slash'){
   for(let i=0;i<3;i++){const u=Math.min(1,t*2),x=b.x-15+i*7,y=b.y-13;line(x,y,x+u*24,y+u*29,dark,4);line(x,y-1,x+u*24,y-1+u*29,light,2)}
  }else if(kind==='bite'){
   const gap=(1-Math.sin(t*Math.PI))*13+3;for(let i=-2;i<=2;i++){ctx.fillStyle=light;ctx.beginPath();ctx.moveTo(b.x+i*6-3,b.y-gap-7);ctx.lineTo(b.x+i*6+3,b.y-gap-7);ctx.lineTo(b.x+i*6,b.y-gap);ctx.fill();ctx.beginPath();ctx.moveTo(b.x+i*6-3,b.y+gap+7);ctx.lineTo(b.x+i*6+3,b.y+gap+7);ctx.lineTo(b.x+i*6,b.y+gap);ctx.fill()}
  }else if(kind==='impact'){
   for(let i=0;i<8;i++){const ang=i*Math.PI/4,r=5+t*13;line(b.x+Math.cos(ang)*r,b.y+Math.sin(ang)*r,b.x+Math.cos(ang)*(r+8),b.y+Math.sin(ang)*(r+8),i%2?dark:light,3)}dot(b.x,b.y,6,light);
  }else if(kind==='rock'||kind==='dig'){
   for(let i=0;i<9;i++){const u=Math.min(1,t*1.5-i*.035),x=b.x+(i%3-1)*12,y=kind==='dig'?b.y+13-Math.sin(u*Math.PI)*15:b.y-38+u*55;dot(x,y,7,dark);dot(x-1,y-1,4,light)}
  }else if(kind==='shield'){
   for(let i=0;i<3;i++)ring(b.x,b.y,15+i*7+Math.sin(t*Math.PI)*5,i%2?dark:light);
  }else if(kind==='heal'||kind==='boost'){
   for(let i=0;i<9;i++){const x=b.x+Math.sin(i*3)*18,y=b.y+20-((t*45+i*6)%45);if(kind==='heal'){line(x-3,y,x+3,y,light,2);line(x,y-3,x,y+3,light,2)}else{line(x-3,y+3,x,y,dark,2);line(x,y,x+3,y+3,light,2)}}ring(b.x,b.y+10,16+t*9,light);
  }else if(kind==='vine'){
   for(let i=0;i<4;i++)ring(b.x,b.y-12+i*8,Math.max(4,25-t*17),'#7a9c59');
  }else if(kind==='sound'||kind==='psychic'||kind==='wind'){
   for(let i=0;i<4;i++){const u=(t+i*.2)%1;ring(a.x+(b.x-a.x)*u,a.y+(b.y-a.y)*u,4+u*20,i%2?dark:light)}
  }else if(kind==='sun'){
   ctx.fillStyle='#ffd35b22';ctx.fillRect(0,0,w,h);for(let i=0;i<8;i++){const x=w*.75+Math.cos(i*Math.PI/4)*25,y=25+Math.sin(i*Math.PI/4)*18;line(x,y,x+Math.cos(i*Math.PI/4)*10,y+Math.sin(i*Math.PI/4)*10,'#ffcc54',3)}dot(w*.75,25,13,'#fff0a0');
  }else if(kind==='terrain'){
   for(let i=0;i<10;i++){const x=(i*29+t*45)%w,y=h-8-(i%3)*8;line(x,y,x+5,y-5,'#ffe45f',2);line(x+5,y-5,x+9,y-1,'#fff4b2',2)}
  }else if(kind==='sand'){
   for(let i=0;i<38;i++)dot((i*29+t*180)%w,(i*17+t*30)%h,2,i%2?'#caa66e':'#ead09a');
  }else if(kind==='weather'){
   for(let i=0;i<35;i++){const x=(i*29+t*25)%w,y=(i*17+t*90)%h;line(x,y,x-3,y+7,light,1)}
  }else{
   for(let i=0;i<9;i++){const ang=i*.7+t*5,x=b.x+Math.cos(ang)*18,y=b.y+Math.sin(ang)*12;dot(x,y,3,i%2?light:dark)}ring(b.x,b.y,12+Math.sin(t*Math.PI)*9,dark);
  }
  ctx.globalAlpha=1;if(t<1)requestAnimationFrame(frame);else resolve()}
 requestAnimationFrame(frame)});}finally{canvas.remove()}
}
function setSpriteSource(el,src){if(el&&el.getAttribute('src')!==src)el.src=src}
// Capture image failures from initial templates as well as in-place switches.
document.addEventListener('error',e=>{const el=e.target;if(el?.tagName!=='IMG'||!el.dataset.num||el.dataset.view==='icons')return;const src=el.getAttribute('src'),fallback=src.replace(/assets\/pixel\/(front|back)\//,'assets/pixel/still-$1/');if(src!==fallback){el.src=fallback}},true);
function sync(view){if(!view)return;for(const s of [0,1]){const v=view[s],el=sprite(s),p=document.querySelector(`.hp-panel.${s?'foe':'player'}`);if(!v||!el||!p)continue;el.dataset.num=String(v.num);el.dataset.view=s===0?'back':'front';setSpriteSource(el,api.source(v.num,s===0));el.alt=v.name;el.dataset.fainted=String(v.hp<=0);el.dataset.underground=String(v.underground);el.style.visibility=el.dataset.present==='false'?'hidden':'';p.querySelector('.hp-heading span').textContent=v.name;const fill=p.querySelector('.hp-fill');fill.style.width=100*v.hp/v.maxhp+'%';fill.style.background=v.hp>v.maxhp/2?'#5eae72':v.hp>v.maxhp/5?'#d1af4c':'#be554e';p.querySelector('.hp-number').textContent=s?'':v.hp+' / '+v.maxhp;p.querySelector('.team-dots').textContent=v.alive.map(x=>x?'●':'○').join(' ')}}
const syncBase=sync;sync=function(view){syncBase(view);if(view)root.FactoryAtmosphere?.statuses(view);root.FactoryPixelText?.drawAll()};
api.sync=sync;
async function move(e,events,index){const m=root.FactoryMeta.moves[e.move],s=e.side,target=self.has(e.move)?s:1-s,kind=family(e.move);const later=[];for(let i=index+1;i<events.length&&events[i].kind!=='move';i++)later.push(events[i]);const miss=later.some(x=>x.kind==='miss');
 const el=sprite(s);if(e.move==='dig'&&later.some(x=>x.kind==='charge')){await particles('dig',s,s,600);return}
 if(el?.dataset.underground==='true'){el.dataset.underground='false';await animate(el,[{opacity:0,transform:'translateY(40px)'},{opacity:1,transform:'translateY(0)'}],240)}
 await root.FactoryChoreography?.prepare?.(e.move,s,miss);
 const duration=root.FactoryChoreography?.duration?.(e.move)||1080;
 let poses=null;
 if(['agility','doubleteam'].includes(e.move))poses=[0,-25,25,-20,20,0].map(x=>({transform:`translateX(${x}px)`}));
 else if(['minimize','defensecurl','withdraw'].includes(e.move))poses=[{transform:'scale(1)'},{transform:`scale(${e.move==='minimize'?.45:.72})`},{transform:'scale(1)'}];
 else if(e.move==='acidarmor')poses=[{transform:'scale(1)',opacity:1},{transform:'scale(.8,.55)',opacity:.6},{transform:'scale(1)',opacity:1}];
 else if(e.move==='tailwhip')poses=[0,-10,10,-10,10,0].map(x=>({transform:`translateX(${x}px)`}));
 else if(['quiverdance','dragondance'].includes(e.move))poses=[{transform:'translate(0,0)'},{transform:'translate(-10px,-8px)'},{transform:'translate(10px,-8px)'},{transform:'translate(0,0)'}];
 else if(e.move==='calmmind')poses=[{transform:'translateY(0)'},{transform:'translateY(-5px)'},{transform:'translateY(0)'}];
 else if(e.move==='feintattack')poses=[{opacity:1},{opacity:.2},{opacity:1}];
 else if(m.category==='Physical')poses=[{transform:'translate(0,0)'},{transform:`translate(${s?-22:22}px,${s?10:-10}px)`},{transform:'translate(0,0)'}];
 const motion=poses?animate(el,poses,duration):Promise.resolve();
 await Promise.all([motion,particles(kind,s,target,duration,miss,e.move)]);
}
// Consume each event batch once without retaining historical battle logs.
const playedBatches=new WeakSet();let playing=false;
api.play=async function(events,onEvent=()=>{}){
 if(playing||playedBatches.has(events))return;
 playedBatches.add(events);playing=true;
 try{
  // Hide both template images before the first await. Each side becomes
  // visible only when its own entrance event is reached.
  if(events[0]?.kind==='battle_start')for(const side of [0,1]){const el=sprite(side);if(el){el.dataset.present='false';el.style.visibility='hidden';el.style.opacity='0'}}
  for(let i=0;i<events.length;i++){
   const e=events[i],side=e.side,el=side===0||side===1?sprite(side):null;
   onEvent(e);const eventStarted=performance.now(),textDuration=root.FactoryPresentationTiming.duration(e)*1000;const recoveryMs=recoveryDurations[e.kind];
   const occupied=el&&el.dataset.present!=='false'&&el.dataset.fainted!=='true';
   const entering=e.kind==='switch'&&(!occupied||Number(el.dataset.num)!==e.visual?.[side]?.num);
   if(!api.enabled){
    if(el&&e.kind==='switch'){el.dataset.present='true';el.style.opacity='1'}
    if(el&&e.kind==='faint')el.dataset.present='false';
    await wait(textDuration);sync(e.visual);continue;
   }
   if(recoveryMs){let applied=false;
    const aura=e.kind==='cure'&&e.visual?.[side]&&!e.visual[side].status?document.querySelector(`.ailment-aura[data-side="${side}"]`):null;
    await particles(e.kind,side,side,recoveryMs,false,'',p=>{if(aura)aura.style.opacity=String(Math.max(0,1-p/.45));if(!applied&&p>=.45){applied=true;sync(e.visual)}},e);
   }
   else if(e.kind==='move')await move(e,events,i);
   else if(e.kind==='damage'){await animate(el,[{opacity:1,transform:'translateX(0)'},{opacity:.25,transform:'translateX(-6px)'},{opacity:1,transform:'translateX(6px)'},{opacity:.3},{opacity:1,transform:'translateX(0)'}],300);sync(e.visual);if(el&&e.visual?.[side]?.hp===0)el.dataset.fainted='false';await wait(220)}
   else if(e.kind==='switch'){
    if(entering&&el){
     
     // Hold invisibility while the outgoing animation releases its transform
     // and the incoming image decodes: no full-size flash before send-out.
     el.style.opacity='0';
     if(occupied)await animate(el,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.1)'}],180);
     sync(e.visual);await el.decode().catch(()=>{});
     el.dataset.present='true';el.style.visibility='';
     await animate(el,[{opacity:0,transform:'scale(.1)'},{opacity:1,transform:'scale(1)'}],300);
     el.style.opacity='1';
    }
   }
   else if(e.kind==='faint'){if(el){el.dataset.fainted='false';await animate(el,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(55px)'}],380);el.dataset.present='false'}}
   else if(e.kind==='charge'){await animate(el,[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(40px)'}],280)}
   else if(['status','confusion','seed','yawn','grudge'].includes(e.kind)&&el){await particles(e.kind==='status'?'powder':'debuff',side,side,360)}
   else if(['miss','fail','blocked','immune','cant','effective','resisted','critical','battle_end'].includes(e.kind)){await wait(['effective','resisted','battle_end'].includes(e.kind)?900:500)}
   if(e.kind!=='move'&&e.kind!=='damage')sync(e.visual);
   const remaining=textDuration-(performance.now()-eventStarted);if(remaining>0)await wait(remaining);
  }
 }finally{playing=false}
};

api.refreshSprites=function(){for(const el of document.querySelectorAll('img[data-num]')){const back=el.dataset.view==='back',num=+el.dataset.num;if(el.dataset.view!=='icons')setSpriteSource(el,api.source(num,back))}};
root.FactoryFX=api;
})(window);
