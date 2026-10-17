(function(){
let selected=0,scope='',returnSelection=0,mode=matchMedia('(pointer:coarse)').matches?'touch':'keyboard';
const visible=x=>!!x.getClientRects().length&&!x.disabled;
function setMode(next){if(mode===next)return;mode=next;document.body.dataset.input=mode;FactoryLayout?.fit();paint();FactoryPixelText?.drawAll()}
function choices(){
 const d=document.querySelector('dialog[open]');
 if(d)return [...d.querySelectorAll('.modal-pad button,#dialog-body button')].filter(visible).sort((a,b)=>a.dataset.input==='back'?-1:b.dataset.input==='back'?1:0);
 const phase=window.factoryApp?.state.phase;
 if(phase==='rental')return [...document.querySelectorAll('.rental-menu button')].filter(visible);
 if(phase==='battle')return [...document.querySelectorAll(document.querySelector('.command-area')?.dataset.menu==='moves'?'.move-btn':'.root-commands button')].filter(visible);
 return [...document.querySelectorAll('#app button')].filter(visible);
}
function paint(){
 if(!window.factoryApp)return;
 const d=document.querySelector('dialog[open]');document.body.classList.toggle('modal-open',!!d);
 if(d&&!d.querySelector('.modal-pad')){
  const bar=document.createElement('div');bar.className='modal-pad';
  const forced=d.dataset.kind==='forced';
  if(!forced){const back=document.createElement('button');back.dataset.input='back';back.dataset.pad='b';back.textContent=d.dataset.kind==='confirm'?'取消':'返回';bar.append(back)}
  if(d.dataset.kind==='confirm'){const action=d.querySelector('#dialog-body button[data-action]');if(action)bar.append(action)}
  d.append(bar);
 }
 const next=d?'dialog:'+d.dataset.serial:factoryApp.state.phase+':'+document.querySelector('.command-area')?.dataset.menu+':'+(!!document.querySelector('[data-action="swap-reset"]'));
 if(next!==scope){if(d&&!scope.startsWith('dialog:'))returnSelection=selected;selected=!d&&scope.startsWith('dialog:')?returnSelection:0;scope=next}
 const xs=choices();selected=Math.min(selected,Math.max(0,xs.length-1));
 document.querySelectorAll('.pad-selected').forEach(x=>x.classList.remove('pad-selected'));xs[selected]?.classList.add('pad-selected');
 document.querySelectorAll('.float-pad button').forEach(x=>x.disabled=!!factoryApp.busy);
 const phase=factoryApp.state.phase,menu=document.querySelector('.command-area')?.dataset.menu;
 const b=document.querySelector('.float-pad [data-pad="b"]');if(b)b.hidden=phase==='division'||phase==='battle'&&menu!=='moves';
 const label=document.querySelector('#options-button');if(label)label.textContent=mode==='controller'?'Y 菜单':mode==='touch'?'菜单':'Tab 菜单';
 const hint=document.querySelector('.screen-hint');
 if(hint&&['division','rental'].includes(phase)){
  const text=phase==='rental'?(mode==='touch'?'点击精灵球切换候选　点击菜单选择　B 返回':mode==='controller'?'◀ ▶ 切换候选　▲ ▼ 选择　A 确认　B 返回':'◀ ▶ 切换候选　▲ ▼ 选择　Z 确认　X 返回'):(mode==='touch'?'点击选择级别':mode==='controller'?'方向键 / 摇杆选择　A 确认　Y 菜单':'方向键 / WASD 选择　Z 确认　Tab 菜单');
  if(hint.textContent!==text)hint.textContent=text;
 }
 if(!d&&menu==='moves'&&xs[selected]){const i=+xs[selected].dataset.action.split(':')[1];if(factoryApp.moveFocus!==i)factoryApp.focusMove(i)}
}
function selectAction(action){paint();const ix=choices().findIndex(x=>x.dataset.action===action);if(ix>=0)selected=ix;paint()}
function input(key){
 if(!window.factoryApp||factoryApp.busy)return;
 paint();const d=document.querySelector('dialog[open]');
 if(key==='b'){factoryApp.back();paint();return}
 if(key==='menu'){factoryApp.options();paint();return}
 if(key==='details'){
  if(!d&&document.querySelector('.command-area')?.dataset.menu==='moves')document.querySelector('.move-info')?.click();
  else if(!d&&factoryApp.state.phase==='rental')document.querySelector('.rental-menu [data-action^="detail:"]')?.click();
  else if(!d&&factoryApp.state.phase==='swap'){const item=choices()[selected],action=item?.dataset.action;if(action?.startsWith('own:')||action?.startsWith('foe:'))factoryApp.details(action.split(':')[0],+action.split(':')[1]);else document.querySelector('.rental-menu [data-action^="detail:"]')?.click()}
  else if(d){const item=choices()[selected];item?.closest('.team-slot')?.querySelector('[data-action^="detail:"]')?.click()}
  paint();return;
 }
 if(d&&['left','right'].includes(key)&&d.querySelector('.summary-tabs')){
  const tabs=[...d.querySelectorAll('.summary-tabs button')],ix=tabs.findIndex(x=>x.classList.contains('active'));
  tabs[(ix+(key==='left'?2:1))%3].click();return;
 }
 if(!d&&factoryApp.state.phase==='rental'&&['left','right'].includes(key)){
  const current=+document.querySelector('.rental-index .current').dataset.action.split(':')[1];
  document.querySelector('.ball-row [data-action="rental-focus:'+((current+(key==='left'?5:1))%6)+'"]').click();return;
 }
 const xs=choices();if(key==='a'){xs[selected]?.click();paint();return}if(!xs.length)return;
 const boxes=xs.map(x=>{const r=x.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});
 selected=FactoryInput.next(boxes,selected,key);paint();xs[selected]?.scrollIntoView({block:'nearest',inline:'nearest'});
}
function mount(){
 document.body.dataset.input=mode;document.querySelector('.float-pad')?.remove();
 const pad=document.createElement('div');pad.className='float-pad';
 pad.innerHTML='<div class="pad-cross">'+[['up','▲'],['left','◀'],['down','▼'],['right','▶']].map(([k,label])=>'<button class="pad-'+k+'" data-pad="'+k+'" aria-label="'+({up:'上',down:'下',left:'左',right:'右'}[k])+'">'+label+'</button>').join('')+'</div><div class="pad-actions"><button data-pad="b">B<small>返回</small></button><button data-pad="a">A<small>确认</small></button></div>';
 document.querySelector('.app-shell').append(pad);paint();
}
document.addEventListener('pointerdown',e=>setMode(e.pointerType==='touch'?'touch':'keyboard'));
document.addEventListener('click',e=>{
 const p=e.target.closest('[data-pad]');if(p){input(p.dataset.pad);return}
 if(e.target.closest('[data-input="back"]')){input('b');return}
 const action=e.target.closest('[data-action]')?.dataset.action;if(action)requestAnimationFrame(()=>selectAction(action));
});
document.addEventListener('keydown',e=>{
 if(e.ctrlKey||e.altKey||e.metaKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
 const key={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right',z:'a',Enter:'a',' ':'a',x:'b',Escape:'b',y:'details',Tab:'menu'}[e.key.length===1?e.key.toLowerCase():e.key];
 if(key){e.preventDefault();if(e.repeat)return;setMode('keyboard');input(key)}
});
FactoryInput.attachGamepads(input,active=>setMode(active?'controller':matchMedia('(pointer:coarse)').matches?'touch':'keyboard'));
window.FactoryPad={mount,paint,input,selectAction,get mode(){return mode},setMode};
})();
