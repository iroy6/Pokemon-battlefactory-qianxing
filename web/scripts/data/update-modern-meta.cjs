// Rebuild the supported move subset from the pinned Showdown Gen IX snapshot.
// No network request is made by builds. See docs/modern-rules.md for the policy.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'../..'),file=path.join(root,'src/data/meta.js');
const M=require(file),context={exports:{}};
const source=fs.readFileSync(path.join(root,'data/sources/current-moves.ts'),'utf8');
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,context);
const moves=context.exports.Moves;
const targets={self:7,normal:10,any:10,allAdjacentFoes:11,allAdjacent:9,allySide:4,foeSide:6,all:12,allies:13};
let changed=0;
for(const [key,m] of Object.entries(M.moves)){
 const current=moves[key==='vicegrip'?'visegrip':key];
 if(!current)throw Error('Missing modern move: '+key);
 const before=JSON.stringify(m);
 Object.assign(m,{power:current.basePower,accuracy:current.accuracy,pp:current.pp,priority:current.priority,type:current.type,category:current.category,contact:!!current.flags?.contact,targetId:targets[current.target]??m.targetId});
 const secondaries=current.secondaries||(current.secondary?[current.secondary]:[]);
 m.flinchChance=secondaries.find(x=>x.volatileStatus==='flinch')?.chance||0;
 m.powder=!!current.flags?.powder;
 m.protectable=!!current.flags?.protect;
 m.critRatio=current.critRatio||1;
 m.noAssist=!!current.flags?.noassist;
 m.mirror=!!current.flags?.mirror;
 delete m.kingsRockEligible;delete m.razorFangEligible;
 if(before!==JSON.stringify(m))changed++;
}
M.chart.Dark.Steel=1;M.chart.Ghost.Steel=1;
const dexContext={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,'data/sources/current-pokedex.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,dexContext);
for(const [key,spec] of Object.entries(M.species)){
 const current=dexContext.exports.Pokedex[key];
 if(!current)throw Error('Missing modern species: '+key);
 Object.assign(spec,{baseStats:current.baseStats,types:current.types,weight:current.weightkg});
}
const speciesPath=path.join(root,'data/species.json'),species=JSON.parse(fs.readFileSync(speciesPath,'utf8'));
for(const set of species.sets)set.bst=Object.values(M.species[set.species.toLowerCase().replace(/[^a-z0-9]/g,'')].baseStats).reduce((a,b)=>a+b,0);
fs.writeFileSync(speciesPath,JSON.stringify(species,null,2)+'\n');
M.version='factory-gen9-sv-v1';M.sourceDate='2026-10-17';
fs.writeFileSync(file,'/* Gen IX Scarlet/Violet rules; rebuild with web/scripts/data/update-modern-meta.cjs. */\n(function(root){const meta='+JSON.stringify(M)+';root.FactoryMeta=meta;if(typeof module!=="undefined")module.exports=meta;})(typeof window!=="undefined"?window:globalThis);\n');
console.log('Modern move metadata:',changed,'supported moves; Steel matchups updated');
