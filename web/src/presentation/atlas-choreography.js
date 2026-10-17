/* The HTML and Lua clients consume the same authored frames. A bounded cache
 * keeps only recent move pages; no particle allocation or path drawing in RAF. */
(function(root){
 const cache=new Map(),budget=32*1024*1024;let bytes=0,clock=0;
 function trim(keep){for(const [key,row]of [...cache].sort((a,b)=>a[1].used-b[1].used)){if(bytes<=budget)break;if(keep.has(key)||row.pending)continue;cache.delete(key);bytes-=row.bytes;row.image.src='';}}
 function page(p){let row=cache.get(p.file);if(row){row.used=++clock;return row;}
  const image=new Image();row={image,used:++clock,bytes:p.w*p.h*4,pending:true};bytes+=row.bytes;cache.set(p.file,row);
  row.ready=new Promise(resolve=>{image.onload=()=>{row.pending=false;resolve();};image.onerror=()=>{row.pending=false;row.failed=true;resolve();};});image.src=p.file;return row;
 }
 async function prepare(move,side,miss=false){const entry=root.FactoryMoveAtlases?.[move];if(!entry)return;const v=entry.variants[side*2+(miss?1:0)];const keep=new Set(v.pages.map(p=>p.file));await Promise.all(v.pages.map(p=>page(p).ready));trim(keep);}
 function draw(ctx,move,side,t,source,target,width,miss=false){const entry=root.FactoryMoveAtlases?.[move];if(!entry)return false;
  const v=entry.variants[side*2+(miss?1:0)],f=v.frames[Math.min(v.frames.length-1,Math.floor(Math.max(0,t)*(v.frames.length-1)))],p=page(v.pages[f[0]]);if(p.pending||p.failed)return true;
  const scale=width/720,srcX=side?565:185,srcY=side?150:268,dstX=side?185:565,dstY=side?268:150;
  // Map the two standard battle anchors to the actual DOM sprite positions.
  const sx=source.x/scale,sy=source.y/scale,tx=target.x/scale,ty=target.y/scale;
  let mx=1,my=1,dx=sx-srcX,dy=sy-srcY;if(!entry.self&&Math.abs(tx-sx)>50){mx=(tx-sx)/(dstX-srcX);my=Math.abs(ty-sy)>12?(ty-sy)/(dstY-srcY):1;dx=sx-srcX*mx;dy=sy-srcY*my;}
  ctx.save();ctx.globalAlpha=1;ctx.imageSmoothingEnabled=false;ctx.scale(scale,scale);ctx.translate(dx,dy);ctx.scale(mx,my);
  ctx.drawImage(p.image,f[1],f[2],f[3],f[4],f[5],f[6],f[3]*2,f[4]*2);ctx.restore();return true;
 }
 root.FactoryChoreography={prepare,draw,ready:Promise.resolve(),duration:move=>(root.FactoryMoveAtlases?.[move]?.duration||1.08)*1000};
})(window);
