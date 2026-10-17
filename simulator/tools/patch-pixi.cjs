// Keep upstream intact; verified targeted adaptation of its browser renderer.
module.exports=function patch(source,{cache,atlas}) {
  const replace=(a,b)=>{if(!source.includes(a))throw Error('Renderer patch anchor missing: '+a.slice(0,70));source=source.replace(a,b);};
  source=`import {FactoryTextureCache,canKeepFrame} from ${JSON.stringify(cache)};\nimport factoryAtlas from ${JSON.stringify(atlas)};\n`+source;
  replace('Application, CanvasSource','Rectangle, Application, CanvasSource');
  replace("import { imageAssetKey,", "import { imageAssetUrl, imageAssetKey,");
  replace('antialias: true','antialias: false');
  // Pixel-art canvas already has explicit game-pixel dimensions. DPR doubling
  // quadruples framebuffer memory without adding source pixels.
  replace('resolution: Math.min(2, window.devicePixelRatio || 1)', 'resolution: 1');
  // One framebuffer pixel per displayed CSS pixel keeps a stable bitmap grid
  // even on fractional Windows DPI (e.g. 150%). A DPR-multiplied buffer gets
  // resampled yet again in the embedded view and makes 1px strokes uneven.
  replace('    if (w === this.canvasWidth && h === this.canvasHeight) return', `    const displayWidth=this.canvas.clientWidth||w;
    const pixelRatio=Math.max(.25,Math.min(1.5,displayWidth/w));
    if(w===this.canvasWidth&&h===this.canvasHeight&&Math.abs(pixelRatio-(this.factoryResolution||0))<.0001)return;
    this.factoryResolution=pixelRatio;`);
  replace('this.app.renderer.resize(w, h)', 'this.app.renderer.resize(w, h, this.factoryResolution);this.factoryResized=true');
  replace('    const list = scene.reset ? scene.nodes : scene.changed',`    const list = scene.reset ? scene.nodes : scene.changed
    if(!scene.reset&&!list?.length&&!scene.removed?.length&&!this.factoryResized)return;
    this.factoryResized=false`);
  replace('new ImageSource({ resource: image })',"new ImageSource({ resource: image, scaleMode:'nearest' })");
  replace('this.ready = this.initialize()',`this.factory = new FactoryTextureCache({atlas:factoryAtlas,Texture,ImageSource,Rectangle,url:id=>imageAssetUrl(id),repaint:()=>this.queueFactoryRepaint()});
    this.factoryWaiting=new Set();this.factoryRepaint=0;this.ready = this.initialize()`);
  replace('  resize(width, height) {',`  queueFactoryRepaint() {
    if(this.disposed||this.factoryRepaint)return;
    this.factoryRepaint=requestAnimationFrame(()=>{this.factoryRepaint=0;if(this.disposed)return;
      for(const root of this.factoryWaiting){const item=root.__sceneItem;if(!item||this.nodes.get(item.id)!==root){this.factoryWaiting.delete(root);continue;}this.updateNode(root,item,{nested:!root.__flat&&item.parent!=null});}
      this.app?.render();this.factoryDiagnostics();
    });
  }
  factoryDiagnostics(){const now=performance.now();if(now-(this.factoryLastDiagnostics||0)<1000)return;this.factoryLastDiagnostics=now;const s=this.factory.stats();for(const [k,v] of Object.entries(s))this.canvas.dataset['factory'+k[0].toUpperCase()+k.slice(1)]=String(v);}
  updateFactorySprite(root,item,width,height){
    const group=this.factory.group(item.imageId);if(!group||item.kind!=='image'||item.primitive!=='sprite')return false;
    const texture=this.factory.get(item.imageId);let visual=root.__visual;
    if(!texture){
      this.factoryWaiting.add(root);
      if(canKeepFrame(visual?.__factoryGroup,group)){this.factory.holds++;return true;}
      this.clearVisual(root);return true;
    }
    this.factoryWaiting.delete(root);
    if(!visual?.__factorySprite){this.clearVisual(root);visual=new Container();visual.eventMode='none';visual.zIndex=-Number.MAX_SAFE_INTEGER;
      visual.__factorySprite=new Sprite({texture,anchor:0.5});visual.addChild(visual.__factorySprite);(root.__imageContent||root).addChildAt(visual,0);root.__visual=visual;
    }
    visual.__factoryGroup=group;visual.__factoryId=item.imageId;
    const sprite=visual.__factorySprite;const changedTexture=sprite.texture!==texture;if(changedTexture)sprite.texture=texture;
    if(changedTexture||visual.__factoryWidth!==width){sprite.width=width;visual.__factoryWidth=width;}if(changedTexture||visual.__factoryHeight!==height){sprite.height=height;visual.__factoryHeight=height;}
    if(visual.__factoryColor!==item.imageColor){const color=argb(item.imageColor,0xffffffff);sprite.tint=color.color;sprite.alpha=color.alpha;visual.__factoryColor=item.imageColor;}sprite.visible=width>0&&height>0;
    return true;
  }
  resize(width, height) {`);
  replace('    if (root.__visualKey !== visualKey) {',`    if(this.updateFactorySprite(root,item,width,height)) {
      this.applyMatrix(root,item,nested);this.updateImageMask(root,item,width,height);return;
    }
    if (root.__visualKey !== visualKey) {`);
  replace('  pruneImageTextures() {',`  pruneImageTextures() {
    const now=performance.now();if(now-(this.factoryLastRetain||0)>=500){this.factoryLastRetain=now;const ids=[];for(const root of this.nodes.values()){if(root.visible!==false){if(root.__sceneItem?.imageId)ids.push(root.__sceneItem.imageId);if(root.__visual?.__factoryId)ids.push(root.__visual.__factoryId);}}this.factory.retain(ids);this.factoryDiagnostics();}`);
  replace('    this.disposed = true',`    this.disposed = true
    cancelAnimationFrame(this.factoryRepaint);this.factoryWaiting.clear();this.factory.destroy()`);
  return source;
};
