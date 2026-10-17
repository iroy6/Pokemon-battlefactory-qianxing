/* Render UI lettering on a small bitmap grid without moving icons or cursors. */
(function(){
const font=window.FactoryFont,glyphImages=new Map(),labels=new WeakMap();
const glyph=ch=>font.glyphs[ch]||font.glyphs['?'];
function glyphImage(ch){
 const g=glyph(ch);let canvas=glyphImages.get(g);if(canvas)return canvas;
 canvas=document.createElement('canvas');canvas.width=g.width;canvas.height=font.height;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';
 for(let y=0;y<font.height;y++)for(let x=0;x<g.width;x++)if(g.rows[y]&(1<<x))ctx.fillRect(x,y,1,1);
 glyphImages.set(g,canvas);return canvas;
}
function draw(el){
 if(!el.getClientRects().length)return;
 const text=el.innerText,style=getComputedStyle(el),scale=parseFloat(style.fontSize)/12;
 const left=parseFloat(style.paddingLeft)||0,right=parseFloat(style.paddingRight)||0;
 if(!el.dataset.ink)el.dataset.ink=style.color;
 const width=Math.max(1,Math.ceil((el.clientWidth-left-right)/scale)),line=16;
 const key=[text,scale,left,width,style.textAlign,style.whiteSpace,el.dataset.ink].join('|');const cached=labels.get(el);
 if(cached?.key===key&&cached.canvas.parentElement===el)return;
 el.querySelector(':scope > .pixel-label')?.remove();const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
 let lines=[],part='',advance=0;
 for(const c of text){if(c==='\n'){lines.push({text:part,width:advance});part='';advance=0;continue}const w=glyph(c).width;if(style.whiteSpace!=='nowrap'&&advance+w>width&&part){lines.push({text:part,width:advance});part='';advance=0}part+=c;advance+=w}if(part)lines.push({text:part,width:advance});
 canvas.width=width;canvas.height=Math.max(line,lines.length*line);ctx.imageSmoothingEnabled=false;
 lines.forEach((row,i)=>{let x=style.textAlign==='right'?width-row.width:style.textAlign==='center'?Math.floor((width-row.width)/2):0;for(const ch of row.text){ctx.drawImage(glyphImage(ch),x,i*line);x+=glyph(ch).width}});
 ctx.globalCompositeOperation='source-in';ctx.fillStyle=el.dataset.ink;ctx.fillRect(0,0,canvas.width,canvas.height);ctx.globalCompositeOperation='source-over';
 canvas.className='pixel-label';canvas.setAttribute('aria-hidden','true');canvas.style.width=canvas.width*scale+'px';canvas.style.height=canvas.height*scale+'px';canvas.style.left=left+'px';canvas.style.maxWidth='none';el.style.position='relative';el.style.color='transparent';el.style.textShadow='none';el.append(canvas);
 labels.set(el,{key,canvas});
}
function drawAll(){
 const selectors='.battle-choice>span,.move-btn>strong,.hp-heading>span,#battle-message,.terminal-head h1,.terminal-head strong,.terminal-talk p,.rental-menu>button,.screen-title,.briefing-board h2,.gba-menu.vertical>button,.summary-mon>b,.summary-moves b,.screen-hint,.rental-roster>span,.ball-choice>span,#dialog-title';
 document.querySelectorAll(selectors).forEach(el=>el.dataset.pixelText='true');
 // Wrap only text nodes: pictures, type labels and controller cursors retain their own boxes.
 for(const root of document.querySelectorAll('#app,#dialog-body,.modal-pad,.topbar')){
  const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let n;
  while(n=walk.nextNode())if(n.textContent.trim()&&!n.parentElement.closest('canvas,script,style,[hidden],[data-pixel-text],.pixel-copy'))nodes.push(n);
  for(const node of nodes){const span=document.createElement('span');span.className='pixel-copy';node.replaceWith(span);span.append(node)}
 }
 document.querySelectorAll('[data-pixel-text],.pixel-copy').forEach(draw);
}
window.FactoryPixelText={drawAll};addEventListener('resize',()=>requestAnimationFrame(drawAll));
})();



