local require=require("default_import_file/workspace/battle-factory/lua/battle_factory_common_fx")
-- Native entry: mount this script once on BattleFactoryHost in the level UI.
-- Load dependencies inside OnStart so a missing mapping produces a useful log.
local app
local started=false
local failed=false
local function reportFailure(err)
 failed=true
 if script then script:EnableUpdate(false) end
 printerr('[BattleFactory 启动/运行失败] '..tostring(err))
 -- This uses an existing native label; it needs no prefab or game data module.
 -- If the level never activates the host, no Lua can display this message.
 pcall(function()
  local host=script.object
  local stage=host:GetChild('BattleFactory')
  local surface=stage and stage:GetChild('Interface')
  local page=surface and surface:GetChild('01 级别选择')
  if not page then return end
  host:SetVisible(true);stage:SetVisible(true);surface:SetVisible(true)
  for _,child in ipairs(surface:GetChildren()) do child:SetVisible(child==page) end
  page:SetActive(true);page:SetVisible(true)
  local modal=host:GetChild('Modal');if modal then modal:SetVisible(false) end
  for _,child in ipairs(page:GetChildren()) do
   if child.name:sub(1,#'文字 选择挑战级别')=='文字 选择挑战级别' then
    local pixels=child:GetChild('PixelText');if pixels then pixels:SetVisible(false) end
    child.text='启动失败：请查看脚本日志'
    child.fontColor=Color.FromRGBA(255,237,96,255)
    child:SetVisible(true)
    break
   end
  end
 end)
end
local function trace(err)return debug.traceback(tostring(err),2) end
function OnStart()
 if started or failed then return end
 started=true
 print('[BattleFactory boot-v7.1-20mb] 入口已执行',script.path)
 local ok,err=xpcall(function()
  local P='default_import_file/workspace/battle-factory/lua/'
  local map=require(P..'battle_factory_mapping')
  -- Check only the three base templates before mutating the saved page.
  for _,key in ipairs({'container','image','input'}) do
   local success,c=pcall(game.InstantiateClientUIControl,map[key],script.object)
   if not success or not c then
    error('基础模板 '..key..'（'..tostring(map[key])..'）无法创建；请校准导入后的客户端模板索引。'..(success and '' or tostring(c)))
   end
   c:SetActive(false);game.DestroyClientUIControl(c)
  end
  app=require(P..'battle_factory_app')
  assert(type(app)=='table' and type(app.start)=='function','app 模块为空或不完整')
  app.start(script)
 end,trace)
 if not ok then reportFailure(err) end
end
function OnUpdate(dt)
 if not app or failed then return end
 local ok,err=xpcall(function()app.update(dt)end,trace)
 if not ok then reportFailure(err) end
end
function Dispatch(action,index)
 if app and not failed then return app.dispatch(action,index) end
end
function GetState()
 if app and not failed then return app.state() end
 return {bootFailed=failed}
end
