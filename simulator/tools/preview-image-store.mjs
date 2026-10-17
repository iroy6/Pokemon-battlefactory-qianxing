// Only explicit files in this project's local manifest can be served.
// These IDs do not claim to exist in the game's image library.
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadImage, createCanvas } from '@napi-rs/canvas';
let manifest, root, manifestFile, manifestStamp='', lastManifestCheck=0;
const cache = new Map();
let cacheBytes = 0;
export const isLocalPreviewId = id => Number.isSafeInteger(id) && id >= 1900000000 && id < 2000000000;
export async function getLocalPreview(id) {
  if (!manifestFile) {
    // Directly launching the bundled server must load the same assets as the
    // PowerShell launcher. An inherited shell environment is not reliable.
    manifestFile = process.env.FACTORY_PREVIEW_MANIFEST || (typeof FACTORY_DEFAULT_MANIFEST === 'string'
      ? FACTORY_DEFAULT_MANIFEST : fileURLToPath(new URL('../preview-assets/manifest.json',import.meta.url)));
    root = realpathSync(dirname(manifestFile));
  }
  // A running preview used to retain its first manifest forever. New glyph
  // IDs then returned 404 even though their files existed on disk. Throttle
  // file metadata reads; only rebuild the small byte cache on a real change.
  const now=Date.now();
  if (!manifest || now-lastManifestCheck>=1000) {
    const stat=statSync(manifestFile),stamp=stat.mtimeMs+':'+stat.size;
    if (stamp!==manifestStamp) {
      const next=JSON.parse(readFileSync(manifestFile,'utf8')).assets;
      manifest=next;manifestStamp=stamp;cache.clear();cacheBytes=0;
    }
    lastManifestCheck=now;
  }
  if (!manifest[id]) throw Object.assign(new Error('Texture is not in the local preview manifest'),{status:404});
  if (cache.has(id)) { const value=cache.get(id);cache.delete(id);cache.set(id,value);return value; }
  const generation=manifestStamp;
  const file = realpathSync(resolve(root,manifest[id].file));
  if (!file.startsWith(root+sep)) throw Object.assign(new Error('Texture path escapes the preview asset directory'),{status:403});
  let data=readFileSync(file);
  // Browser rendering requests atlas pages. Individual frame consumers (native
  // image rendering/export) receive the exact crop rather than a whole atlas.
  if(manifest[id].crop){const [x,y,w,h]=manifest[id].crop;const image=await loadImage(data);const canvas=createCanvas(w,h);canvas.getContext('2d').drawImage(image,x,y,w,h,0,0,w,h);data=canvas.toBuffer('image/png');}
  // HTTP consumers only need bytes. Do not decode every atlas in the server.
  // Host screenshot consumers await image; normal preview never allocates it.
  const value={data,get image(){return loadImage(data)},etag:'"'+createHash('sha256').update(data).digest('hex')+'"'};
  if(generation===manifestStamp){
    if(cache.has(id))cacheBytes-=cache.get(id).data.length;
    cache.set(id,value);cacheBytes+=data.length;
  }
  while(cache.size>256||cacheBytes>8*1024*1024){const first=cache.keys().next().value;cacheBytes-=cache.get(first).data.length;cache.delete(first);}
  return value;
}
