-- Generated entry. Script mapping 1073742105 mounts on server asset's client container n1.
local app=require('default_import_file/simulator/lua/battle_factory_app')
function OnStart() app.start(script) end
function OnUpdate(dt) app.update(dt) end
function Dispatch(action,index) app.dispatch(action,index) end
function GetState() return app.state() end
