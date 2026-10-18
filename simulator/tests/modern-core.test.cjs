const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {lua,lauxlib,lualib,to_luastring,to_jsstring}=require('fengari');
const root=path.resolve(__dirname,'../..');
test('both generated Lua cores implement modern damage, weather, status and items',()=>{
 for(const runtime of ['simulator','qianxing']){
  // The native namespace adapter is exercised separately by verify-runtime.mjs.
  const core=fs.readFileSync(path.join(root,runtime,'lua/battle_factory_core.lua'),'utf8').replace(/^local require=.*\n/,'');
  const script=`local F=(function()\n${core}\nend)()
local E,M=F.engine,F.meta
local function mon()
 local set=F.clone(F.data.sets[0]);set.moves=F.arr(4,'strength','doublekick','watergun','protect')
 local m=F.call(E,'createMon',set);m.ability='';m.item='';m.itemActive=false;m.types=F.arr(1,'Normal');return m
end
local function battle() return F.new(E.Battle,F.arr(2,mon(),mon()),F.arr(2,mon(),mon()),217) end
assert(M.version=='factory-gen9-sv-v1')
assert(M.moves.thunderbolt.power==90 and M.moves.protect.priority==4)
assert(M.species.clefairy.types[0]=='Fairy' and M.chart.Ghost.Steel==1)
local b=battle();local a=F.call(b,'mon',0);local foe=F.call(b,'mon',1)
local speed=F.call(b,'speed',0);assert(F.call(b,'setStatus',0,'par'));assert(F.call(b,'speed',0)==math.floor(speed/2))
a.status='brn';a.hp=160;a.maxhp=160;F.call(b,'residual');assert(a.hp==150)
a.status='';a.hp=a.maxhp;foe.hp=10;foe.maxhp=10;foe.ability='Sturdy'
F.call(b,'damage',1,1000,'attack',true,0,M.moves.strength);assert(foe.hp==1)
foe.hp=10;foe.ability='';foe.item='Focus Sash';foe.itemActive=true
F.call(b,'damage',1,1000,'attack',true,0,M.moves.strength);assert(foe.hp==1 and not foe.itemActive)
F.call(b,'damage',1,1000,'attack',true,0,M.moves.strength);assert(foe.hp==0)
b=battle();a=F.call(b,'mon',0);a.ability='Sand Stream';F.call(b,'enter',0);assert(b.weatherLeft==5)
for i=1,5 do F.call(b,'residual') end;assert(b.weather=='')
b=battle();a=F.call(b,'mon',0);a.moves=F.arr(1,F.obj({id='watersport',pp=15,maxpp=15}));F.call(b,'use',0,'watersport');F.call(b,'switch',0,1);assert(b.field.watersport==5)
for i=1,5 do F.call(b,'residual') end;assert(not b.field.watersport)
return true`;
  const L=lauxlib.luaL_newstate();lualib.luaL_openlibs(L);
  try{const status=lauxlib.luaL_dostring(L,to_luastring(script));assert.equal(status,lua.LUA_OK,status?runtime+': '+to_jsstring(lua.lua_tostring(L,-1)):runtime)}finally{lua.lua_close(L)}
 }
});
