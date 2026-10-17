local require=require("default_import_file/workspace/battle-factory/lua/battle_factory_common_fx")
-- Session entropy only. Combat uses the separately seeded deterministic core RNG.
-- All APIs below are allowed by the client Lua 5.3 documentation. Do not call
-- math.randomseed: it would alter randomness belonging to other game scripts.
local R={}
local serial,previous=0,0
local modulus=2147483646.0
local function mix(value,part)
 return (value*48271.0+math.floor(part)%modulus)%modulus
end
function R.nextSeed()
 serial=serial+1
 local value=mix(previous,os.time())
 value=mix(value,os.clock()*1000000.0)
 value=mix(value,math.random()*modulus)
 value=mix(value,serial)
 local seed=math.floor(value)+1
 if seed==previous then seed=seed%modulus+1 end
 previous=seed
 return seed
end
return R
