// Reproducible local preview adapter; upstream checkout and installed packages
// are left intact. Lua still runs inside the simulator's actual Lua runtime.
const fs=require('fs'),path=require('path');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),workspace=path.resolve(root,'..');
const repo=process.env.FACTORY_SIMULATOR_SOURCE || path.join(root,'.cache/upstream');
const runtime=path.join(workspace,'node_modules');
const {build}=require(path.join(runtime,'esbuild'));
const output=path.join(root,'dist');
// Use the checked-in bitmap font and image atlas; no system font is required.
if (!fs.existsSync(path.join(repo,'web/server.js'))) throw Error('Run npm run setup:simulator first.');
const assetRoot=path.join(root,'preview-assets');
console.log('Validated cropped animation bindings:',require('./check-atlas-crops.cjs')(root));
const manifestText=fs.readFileSync(path.join(assetRoot,'manifest.json'),'utf8');
const assetHash=createHash('sha256').update(manifestText).update(fs.readFileSync(path.join(assetRoot,'atlas-index.json')));
for(const file of [...new Set(Object.values(JSON.parse(manifestText).assets).map(a=>a.file))].sort())assetHash.update(file).update(fs.readFileSync(path.join(assetRoot,file)));
const assetRevision=assetHash.digest('hex').slice(0,20);
fs.mkdirSync(output,{recursive:true});
const aliases={'qxqy-studio':path.join(repo,'studio'),'qxqy-lua-runtime':path.join(repo,'client/lua-runtime'),'qxqy-server':path.join(repo,'server'),'qxqy-editor-ui':path.join(repo,'editor-ui')};
const plugin={name:'local-preview-textures',setup(b){
 b.onLoad({filter:/[\\/]studio[\\/]index\.js$/},async a=>({contents:require('./patch-native-identities.cjs')(fs.readFileSync(a.path,'utf8')),loader:'js'}));
 b.onLoad({filter:/[\\/]host[\\/]controller\.js$/},async a=>({contents:require('./patch-preview-session.cjs').controller(fs.readFileSync(a.path,'utf8')),loader:'js'}));
 b.onLoad({filter:/[\\/]editor-ui[\\/]index\.js$/},async a=>({contents:require('./patch-editor-layout.cjs')(fs.readFileSync(a.path,'utf8')),loader:'js'}));
 b.onLoad({filter:/[\\/]play[\\/]browser-session\.js$/},async a=>({contents:require('./patch-preview-input.cjs').session(fs.readFileSync(a.path,'utf8')),loader:'js'}));
 b.onLoad({filter:/[\\/]play[\\/]session\.js$/},async a=>({contents:require('./patch-preview-input.cjs').runtime(fs.readFileSync(a.path,'utf8')),loader:'js'}));
 b.onLoad({filter:/[\\/]web[\\/]lib[\\/]editor-sessions\.js$/},async a=>({contents:require('./patch-preview-session.cjs').server(fs.readFileSync(a.path,'utf8')),loader:'js'}));
 b.onLoad({filter:/[\\/]assets[\\/]catalog\.js$/},async a=>({contents:require('./patch-preview-assets.cjs').catalog(fs.readFileSync(a.path,'utf8'),assetRevision),loader:'js'}));
 b.onLoad({filter:/[\\/]host[\\/]image-assets\.js$/},async a=>({contents:`import {isLocalPreviewId,getLocalPreview} from ${JSON.stringify(path.join(__dirname,'preview-image-store.mjs'))};\n`+fs.readFileSync(a.path,'utf8')
 .replace('try {\n      const store = this.forSource(imageSource)','try {\n      if (isLocalPreviewId(id) && imageSourceName(imageSource)===\'StaticReference\') return getLocalPreview(id);\n      const store = this.forSource(imageSource)')
 .replace('images.set(key, image.image)','images.set(key, await image.image)')
 .replaceAll("'cache-control': 'private, max-age=43200'","'cache-control': isLocalPreviewId(Number(match[2])) ? 'private, no-cache' : 'private, max-age=43200'")
 .replace('metadata(id, { imageSource = this.imageSource, refresh = false } = {}) {','metadata(id, { imageSource = this.imageSource, refresh = false } = {}) {\n    if (isLocalPreviewId(id) && imageSourceName(imageSource)===\'StaticReference\') return Promise.resolve({meta:null,raw:null});'),loader:'js'}));
 b.onLoad({filter:/[\\/]play[\\/]pixi-renderer\.js$/},async a=>({contents:require('./patch-pixi.cjs')(fs.readFileSync(a.path,'utf8'),{cache:path.join(__dirname,'preview-textures.mjs'),atlas:path.join(root,'preview-assets/atlas-index.json')}),loader:'js'}));
 b.onLoad({filter:/[\\/]host-png\.js$/},async a=>({contents:fs.readFileSync(a.path,'utf8').replaceAll("const ctx = canvas.getContext('2d')","const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false"),loader:'js'}));
}};
async function bundle(entry,out,browser=false){await build({entryPoints:[path.join(repo,entry)],outfile:path.join(output,out),bundle:true,format:'esm',platform:browser?'browser':'node',target:browser?'es2022':'node20',minify:false,alias:aliases,nodePaths:[runtime],define:{},external:browser?[]:['@napi-rs/canvas','fengari','protobufjs'],plugins:[plugin]});}
(async()=>{
 fs.cpSync(path.join(runtime,'beyond-simulator-web/dist/public'),path.join(output,'public'),{recursive:true});
 for(const file of ['LICENSE','THIRD_PARTY_NOTICES.txt'])fs.copyFileSync(path.join(workspace,file),path.join(output,'public',file));
 const playClient=path.join(output,'public/play.js');fs.writeFileSync(playClient,require('./patch-preview-input.cjs').client(require('./patch-preview-session.cjs').client(fs.readFileSync(playClient,'utf8'))));
 fs.appendFileSync(path.join(output,'public/play.css'),`\n/* Crisp canvas; the preview toolbar must not compress Chinese into columns. */
canvas{image-rendering:pixelated}.bar button,.brand strong,.view-tabs{white-space:nowrap}
@media(max-width:900px){.app{grid-template-rows:98px minmax(0,1fr) 34px}.bar{grid-template-columns:minmax(0,1fr) auto;gap:4px;padding:6px 10px}.brand{grid-column:1}.view-tabs{grid-column:2}.actions{grid-column:1 / -1;justify-content:flex-end}.playersel,.viewsel{width:85px;margin-left:4px}.status{gap:6px;padding:0 8px}.status .metric{padding-left:6px}.workspace{padding:12px}}
`);
 await bundle('web/server.js','server.mjs');await bundle('studio/host/worker.js','worker.js');
 await bundle('studio/play/pixi-renderer.js','public/play-renderer.js',true);await bundle('web/lib/editor-client.js','public/editor.js',true);
 await bundle('studio/index.js','studio.mjs');await bundle('studio/host-png.js','host-png.mjs');
 fs.writeFileSync(path.join(output,'package.json'),JSON.stringify({type:'module'}));
 fs.writeFileSync(path.join(output,'asset-revision.json'),JSON.stringify({revision:assetRevision}));
 console.log('Built local simulator texture adapter:',output);
})().catch(e=>{console.error(e);process.exitCode=1;});
