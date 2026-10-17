const fs=require('node:fs'),path=require('node:path');
module.exports=function check(root){
 const assets=JSON.parse(fs.readFileSync(path.join(root,'preview-assets/manifest.json'))).assets;
 const atlas=JSON.parse(fs.readFileSync(path.join(root,'preview-assets/atlas-index.json')));
 let checked=0;for(const [id,row]of Object.entries(assets)){
  if(!row.crop)continue;
  const frame=atlas.frames[id],page=frame&&atlas.pages[frame[0]],sheet=page&&assets[page[0]];
  if(!frame||!sheet||sheet.file!==row.file||JSON.stringify(frame.slice(1,5))!==JSON.stringify(row.crop))throw Error('Animation crop mismatch for '+id+'. Rebuild with export-atlases.py before publishing.');
  if(row.file.startsWith('choreography/')&&!row.file.includes('source-tiles-')&&!frame[5].startsWith('move-'))throw Error('Animation preloading group lost for '+id);
  checked++;
 }return checked;
};
if(require.main===module)console.log('Validated cropped frames:',module.exports(path.resolve(__dirname,'..')));
