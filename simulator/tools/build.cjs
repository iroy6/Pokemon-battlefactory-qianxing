const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..');process.chdir(root);
const {compile}=require('./compile.cjs');
const D=require('../../web/src/data/species-data.js'),M=require('../../web/src/data/meta.js'),I=require('../../web/src/data/info.js'),P=require('../../web/src/data/rental-pools.js');
const q=s=>JSON.stringify(s);
function lua(x){if(x==null)return x===null?'JNULL':'nil';if(typeof x==='boolean'||typeof x==='number')return String(x);if(typeof x==='string')return q(x);if(Array.isArray(x))return `Jarr(${x.length}${x.length?','+x.map(lua).join(','):''})`;return `Jobj({${Object.entries(x).filter(([k,v])=>typeof v!=='function').map(([k,v])=>`[${q(k)}]=${lua(v)}`).join(',')}})`}
const source=fs.readFileSync('web/src/game/engine.js','utf8');
let logic=source.slice(source.indexOf('const id=D.toID'),source.indexOf('root.FactoryEngine=api;'))+'return api;';
// Factory.draw pruning lives in the shared engine so both runtimes use identical RNG ordering.
let data=`local v_D=Jobj({sets=Jarr(0),speciesSets=Jarr(0),divisions=${lua(D.divisions)},types=${lua(D.types)},moveNames=${lua(D.moveNames)}})\nv_D.toID=function(_,s) return string.lower(tostring(s)):gsub('[^a-z0-9]','') end\n`;
// Historical builds stay in the source archive; Lua needs one species identity
// and its partial learnset, not thousands of pre-instantiated configurations.
for(let k=0;k<D.speciesSets.length;k+=64){data+='do local function fill()\n';for(let s of D.speciesSets.slice(k,k+64))data+=`AM.push(v_D.sets,${lua(s)})\n`;data+='end; fill() end\n'}
data+=`v_D.speciesSets=v_D.sets\nlocal v_P=Jobj({schema=${P.schema},species=Jobj({}),itemNames=${lua(P.itemNames)},abilityNames=${lua(P.abilityNames)},natureNames=${lua(P.natureNames)}})\n`;
for(const [num,row] of Object.entries(P.species))data+=`Jset(v_P.species,${q(num)},${lua(row)})\n`;
data+='local v_M=Jobj({})\n';for(let [k,v] of Object.entries(M)) {if(v&&typeof v==='object'&&!Array.isArray(v)){data+=`v_M[${q(k)}]=Jobj({})\n`;for(let [n,t] of Object.entries(v))data+=`Jset(v_M[${q(k)}],${q(n)},${lua(t)})\n`}else data+=`v_M[${q(k)}]=${lua(v)}\n`}
data+='local INFO='+lua(I)+'\n';
const runtime=fs.readFileSync(path.join(__dirname,'runtime.lua'),'utf8');
const compiled=compile(logic),generator=fs.readFileSync('web/src/game/rental-generator.js','utf8');
const generatorLogic=generator.slice(generator.indexOf('const rules='),generator.indexOf('root.FactoryRentalGenerator=api;'))+'return api;';
const result=`-- GENERATED from the offline HTML rules. Rebuild: npm run build:lua\nlocal function loadBattleFactory()\n${runtime}\n${data}\nlocal v_G=(function()\n${compile(generatorLogic)}\nend)()\nlocal ENGINE=(function()\n${compiled}\nend)()\nreturn {engine=ENGINE,null=JNULL,data=v_D,meta=v_M,info=INFO,new=Jnew,call=Jcall,get=Jget,set=Jset,invoke=Jinvoke,arr=Jarr,obj=Jobj,iter=Jiter,clone=Jclone}\nend\nreturn loadBattleFactory()\n`;
fs.mkdirSync('simulator/lua',{recursive:true});fs.writeFileSync('simulator/lua/battle_factory_core.lua',result);
console.log(`Lua core: ${D.speciesSets.length} species, live constrained learnsets, ${result.length} characters`);
const vm=require('vm'),effects=fs.readFileSync('web/src/presentation/effects.js','utf8');
const literal=name=>vm.runInNewContext('('+effects.match(new RegExp(`const ${name}=(\\{[\\s\\S]*?\\});`))[1]+')');
const groups=literal('groups'),styles=literal('styles'),typeFamilies=literal('typeFamilies');styles.dragon=['#b8a9ff','#6751b6'];
const self=vm.runInNewContext(effects.match(/const self=new Set\((\[[^;]+?\])\)/)[1]);
const families=Object.fromEntries(Object.entries(M.moves).map(([id,m])=>[id,({sunnyday:'sun',sandstorm:'sand',electricterrain:'terrain'})[id]||Object.keys(groups).find(k=>groups[k].split(' ').includes(id))||(m.category==='Status'?'debuff':typeFamilies[m.type]||'impact')]));
const native=x=>Array.isArray(x)?'{'+x.map(native).join(',')+'}':x&&typeof x==='object'?'{'+Object.entries(x).map(([k,v])=>`[${q(k)}]=${native(v)}`).join(',')+'}':JSON.stringify(x);
fs.writeFileSync('simulator/lua/battle_factory_effect_data.lua','-- Generated from web/src/presentation/effects.js\nreturn '+native({families,styles,self:Object.fromEntries(self.map(k=>[k,true]))})+'\n');
