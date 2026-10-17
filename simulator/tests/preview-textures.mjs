import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {createRequire} from 'node:module';
import {FactoryTextureCache,canKeepFrame} from '../tools/preview-textures.mjs';
class Source{constructor(o){Object.assign(this,o);}destroy(){this.destroyed=true;}}
class Texture{constructor(o){Object.assign(this,o);}destroy(source){this.destroyed=true;if(source)this.source.destroy();}}
class Rectangle{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
class Container{constructor(){this.children=[];}addChild(c){c.parent=this;this.children.push(c);}addChildAt(c){this.addChild(c);}removeChild(c){this.children=this.children.filter(x=>x!==c);c.parent=null;}destroy(){this.destroyed=true;}}
class Sprite{constructor(o){Object.assign(this,o);}}
const atlas=JSON.parse(fs.readFileSync(new URL('../preview-assets/atlas-index.json',import.meta.url)));
const pending=[];let now=0;
function cache(index=atlas){return new FactoryTextureCache({atlas:index,Texture,ImageSource:Source,Rectangle,url:id=>id,repaint(){},now:()=>now,load:id=>new Promise(resolve=>pending.push(()=>resolve({id}))) });}
async function flush(){while(pending.length)pending.shift()();await Promise.resolve();await Promise.resolve();}
test('all frames in one sheet share one decoded source and GPU source',async()=>{
 const c=cache();const ids=Object.keys(atlas.frames).filter(id=>atlas.frames[id][5]==='25-front');for(const id of ids)c.get(id);await flush();const pages=new Set(ids.map(id=>atlas.frames[id][0]));assert.equal(c.loads,pages.size);
 const textures=ids.map(id=>c.get(id));assert.equal(new Set(textures.map(t=>t.source)).size,pages.size);assert.ok(textures.every(t=>!t.source.destroyed));c.destroy();assert.equal(c.stats().bytes,0);
});

test('a failed atlas retries and repaints static text without another scene delta',async()=>{
 const retries=[];let loads=0,paints=0;
 const c=new FactoryTextureCache({atlas,Texture,ImageSource:Source,Rectangle,url:id=>id,repaint(){paints++;},schedule:fn=>{retries.push(fn);return fn;},cancel:fn=>{const i=retries.indexOf(fn);if(i>=0)retries.splice(i,1);},load:async id=>{if(++loads===1)throw Error('temporary failure');return {id};}});
 const id=Object.keys(atlas.frames)[0];c.get(id);await Promise.resolve();await Promise.resolve();
 assert.equal(c.failures,1);assert.equal(retries.length,1);retries.shift()();await Promise.resolve();await Promise.resolve();
 assert.ok(c.get(id));assert.ok(paints>=2);c.destroy();assert.equal(c.stats().bytes,0);
});

test('failed atlases stop retrying when their renderer is disposed',async()=>{
 const retries=new Set();const c=new FactoryTextureCache({atlas,Texture,ImageSource:Source,Rectangle,url:id=>id,repaint(){},schedule:fn=>{retries.add(fn);return fn;},cancel:fn=>retries.delete(fn),load:async()=>{throw Error('offline');}});
 c.get(Object.keys(atlas.frames)[0]);await Promise.resolve();await Promise.resolve();assert.ok(retries.size);c.destroy();assert.equal(retries.size,0);
});
test('rotating 100 species leaves a bounded idle cache and disposes GPU sources',async()=>{
 const c=cache();let peak=0;const names=Object.keys(atlas.groups).filter(g=>g.endsWith('-front')).slice(0,100);
 for(const group of names){const id=Object.keys(atlas.frames).find(id=>atlas.frames[id][5]===group);c.get(id);await flush();c.get(id);now+=1100;c.retain([id]);peak=Math.max(peak,c.stats().bytes);assert.ok(c.stats().bytes<=64*1024*1024);}
 now+=11000;c.retain([]);assert.equal(c.stats().bytes,0);assert.equal(c.frames.size,0);c.destroy();console.log('Atlas cache peak bytes',peak);
});
test('pending frames hold only the same species/facing and never draw a missing red box',async()=>{
 const require=createRequire(import.meta.url);let src=fs.readFileSync(new URL('fixtures/pixi-renderer.js',import.meta.url),'utf8');
 src=require('../tools/patch-pixi.cjs')(src,{cache:'cache',atlas:'atlas'}).replace(/^import .*$/gm,'').replaceAll('export function','function').replace('export class','class').replace(/export \{[\s\S]*$/,'')+'\nthis.Renderer=PixiPlayRenderer;';
 const context={Container,Sprite,Texture,ImageSource:Source,Rectangle,FactoryTextureCache,canKeepFrame,factoryAtlas:atlas};vm.runInNewContext(src,context);
 const c=cache();const r=Object.create(context.Renderer.prototype);r.factory=c;r.factoryWaiting=new Set();const root=new Container();let id=Object.keys(atlas.frames).find(id=>atlas.frames[id][5]==='25-front');let next=Object.keys(atlas.frames).find(id=>atlas.frames[id][5]==='6-front');
 r.updateFactorySprite(root,{kind:'image',primitive:'sprite',imageId:id},112,112);assert.equal(root.__visual,undefined);assert.equal(r.factoryWaiting.size,1);await flush();r.updateFactorySprite(root,{kind:'image',primitive:'sprite',imageId:id},112,112);assert.equal(r.factoryWaiting.size,0);const original=root.__visual;
 // Same group pending image may retain original. A new species must clear it.
 assert.equal(canKeepFrame('25-front','25-front'),true);assert.equal(canKeepFrame('25-front','25-back'),false);
 r.updateFactorySprite(root,{kind:'image',primitive:'sprite',imageId:next},112,112);assert.equal(root.__visual,null);assert.ok(original.destroyed);await flush();r.updateFactorySprite(root,{kind:'image',primitive:'sprite',imageId:next},112,112);assert.equal(root.__visual.__factoryGroup,'6-front');c.destroy();
 let renders=0;r.ready=Promise.resolve();r.resize=()=>{};r.nodes=new Map();r.app={render(){renders++}};r.pruneImageTextures=()=>{};
 await r.applyScene({format:'tree-v1',changed:[],removed:[]},1280,720);assert.equal(renders,0,'Unchanged scenes must not redraw the GPU canvas');
 r.factoryResized=true;await r.applyScene({format:'tree-v1',changed:[],removed:[]},1280,720);assert.equal(renders,1,'Resizing still repaints even without changed nodes');
});
