/* Shared by the HTML game and the simulator preview adapter. */
(function(root){
 function next(items,current,direction){
  const a=items[current];if(!a)return 0;
  const horizontal=direction==='left'||direction==='right',sign=['left','up'].includes(direction)?-1:1;
  const candidates=items.map((b,i)=>({i,b,along:((horizontal?b.x+b.w/2:b.y+b.h/2)-(horizontal?a.x+a.w/2:a.y+a.h/2))*sign,across:Math.abs((horizontal?b.y+b.h/2:b.x+b.w/2)-(horizontal?a.y+a.h/2:a.x+a.w/2))})).filter(x=>x.i!==current&&!x.b.disabled);
  const forward=candidates.filter(x=>x.along>1).sort((a,b)=>(a.along+a.across*5)-(b.along+b.across*5));
  if(forward.length)return forward[0].i;
  return candidates.filter(x=>x.along<0&&x.across<Math.max(horizontal?a.h:a.w,32)/2).sort((a,b)=>(a.along+a.across*5)-(b.along+b.across*5))[0]?.i??current;
 }
 class GamepadReader{
  constructor(){this.reset()}
  reset(){this.previous=null;this.direction=null;this.repeatAt=0}
  sample(pad,time){
   if(!pad||pad.mapping!=='standard'){this.reset();return []}
   const held=i=>!!pad.buttons[i]?.pressed,x=pad.axes[0]||0,y=pad.axes[1]||0;
   const direction=held(12)?'up':held(13)?'down':held(14)?'left':held(15)?'right':Math.max(Math.abs(x),Math.abs(y))<.55?null:Math.abs(x)>Math.abs(y)?x<0?'left':'right':y<0?'up':'down';
   const down={a:held(0),b:held(1),details:held(2),menu:held(3)||held(9)},out=[];
   // Require release after connect, resume or a tab switch. Held confirm never repeats.
   if(this.previous===null){this.previous=down;this.direction=direction;this.repeatAt=time+350;return out}
   for(const k of Object.keys(down))if(down[k]&&!this.previous[k])out.push(k);
   if(direction!==this.direction){if(direction)out.push(direction);this.repeatAt=time+350}
   else if(direction&&time>=this.repeatAt){out.push(direction);this.repeatAt=time+150}
   this.previous=down;this.direction=direction;return out;
  }
 }
 function attachGamepads(input,mode){
  const reader=new GamepadReader();let timer=0,index=-1,disposed=false;
  const stop=()=>{clearTimeout(timer);timer=0;reader.reset();index=-1};
  function poll(){timer=0;if(disposed||document.hidden||!document.hasFocus())return;
   const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.connected&&p.mapping==='standard');
   if(!pad){if(index>=0)mode(false);stop();return}
   if(index!==pad.index){reader.reset();index=pad.index}
   for(const key of reader.sample(pad,performance.now())){mode(true);input(key)}
   timer=setTimeout(poll,33);
  }
  const start=()=>{if(!timer&&!document.hidden&&!disposed)poll()};
  const visibility=()=>{if(document.hidden)stop();else start()};
  addEventListener('gamepadconnected',start);addEventListener('gamepaddisconnected',()=>{mode(false);stop();start()});document.addEventListener('visibilitychange',visibility);addEventListener('blur',stop);addEventListener('focus',start);addEventListener('pagehide',stop);start();
  return ()=>{disposed=true;stop();removeEventListener('gamepadconnected',start);document.removeEventListener('visibilitychange',visibility);removeEventListener('blur',stop);removeEventListener('focus',start);removeEventListener('pagehide',stop)};
 }
 const api={next,GamepadReader,attachGamepads};
 if(typeof window!=='undefined')root.FactoryInput=api;
 if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
