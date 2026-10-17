// One decoded image/GPU source per atlas; never one source per animation frame.
// This cache belongs to one renderer and is disposed with that renderer.
export class FactoryTextureCache {
  constructor({atlas, Texture, ImageSource, Rectangle, url, repaint, load, now=()=>performance.now(), budget=64*1024*1024, schedule=setTimeout, cancel=clearTimeout}) {
    Object.assign(this,{atlas,Texture,ImageSource,Rectangle,url,repaint,now,budget,schedule,cancel});
    this.pages=new Map();this.frames=new Map();this.active=new Set();this.disposed=false;
    this.failures=0;this.holds=0;this.lastPrune=0;this.loads=0;
    this.load=load||((url)=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Atlas load failed: '+url));image.src=url;}));
  }
  group(id) { return this.atlas.frames[id]?.[5] || null; }
  page(index,attempt=0) {
    let p=this.pages.get(index);if(p){p.used=this.now();return p;}
    const [id,w,h]=this.atlas.pages[index];p={index,used:this.now(),bytes:w*h*4,source:null,pending:true};this.pages.set(index,p);this.loads++;
    p.promise=this.load(this.url(id)).then(image=>{
      if(this.disposed||this.pages.get(index)!==p)return;
      p.source=new this.ImageSource({resource:image,scaleMode:'nearest'});p.pending=false;this.repaint();
    },error=>{
      if(this.disposed||this.pages.get(index)!==p)return;
      p.pending=false;p.error=error;this.failures++;this.repaint();
      // Static text may receive no further scene updates. Retry and repaint
      // independently, otherwise one failed request leaves it blank forever.
      if(attempt<3)p.retry=this.schedule(()=>{
        if(this.disposed||this.pages.get(index)!==p)return;
        this.pages.delete(index);this.page(index,attempt+1);
      },[250,1000,4000][attempt]);
    });return p;
  }
  get(id) {
    const row=this.atlas.frames[id];if(!row)return null;
    const [page,x,y,w,h,group]=row;
    // Repeated glyphs and unchanged sprites use one lookup, not a scan of all
    // pages in their group on every update.
    const cached=this.frames.get(id);if(cached){const p=this.pages.get(cached.page);if(p?.source){p.used=this.now();return cached.texture;}}
    // A group is one species AND one facing. It cannot carry the wrong mon.
    for(const i of this.atlas.groups[group])this.page(i);
    const p=this.page(page);if(!p.source)return null;
    let frame=this.frames.get(id);
    if(!frame){frame={page,texture:new this.Texture({source:p.source,frame:new this.Rectangle(x,y,w,h)})};this.frames.set(id,frame);}
    return frame.texture;
  }
  retain(ids) {
    this.active.clear();for(const id of ids){const row=this.atlas.frames[id];if(row)for(const page of this.atlas.groups[row[5]])this.active.add(page);}
    const now=this.now();if(now-this.lastPrune<1000)return;this.lastPrune=now;
    let bytes=[...this.pages.values()].reduce((n,p)=>n+p.bytes,0);
    for(const p of [...this.pages.values()].sort((a,b)=>a.used-b.used)){
      if(this.active.has(p.index)||p.pending)continue;
      if(bytes<=this.budget&&now-p.used<10000)continue;
      for(const [id,frame]of this.frames)if(frame.page===p.index){frame.texture.destroy(false);this.frames.delete(id);}
      if(p.retry)this.cancel(p.retry);p.source?.destroy();this.pages.delete(p.index);bytes-=p.bytes;
    }
  }
  stats(){return {pages:this.pages.size,frames:this.frames.size,bytes:[...this.pages.values()].reduce((n,p)=>n+(p.source?p.bytes:0),0),pending:[...this.pages.values()].filter(p=>p.pending).length,failures:this.failures,loads:this.loads,holds:this.holds};}
  destroy(){this.disposed=true;for(const f of this.frames.values())f.texture.destroy(false);this.frames.clear();for(const p of this.pages.values()){if(p.retry)this.cancel(p.retry);p.source?.destroy();}this.pages.clear();}
}

// Loading a different species must never keep the former species on screen.
export function canKeepFrame(previousGroup,nextGroup){return !!previousGroup&&previousGroup===nextGroup;}
