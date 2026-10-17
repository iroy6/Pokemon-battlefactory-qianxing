-- Official client key enums; no browser key names are used in the Lua client.
local N={}
N.bindings={
 {'KeyboardCraftspersonKey12Down','confirm'}, {'KeyboardJumpKeyDown','confirm'},
 {'KeyboardDropKeyDown','back'}, {'KeyboardOpenShortcutWheelKeyDown','options'},
 {'KeyboardCraftspersonKey13Down','details'},
 {'KeyboardCraftspersonKey36Down','direction','up'}, {'KeyboardCraftspersonKey37Down','direction','down'},
 {'KeyboardCraftspersonKey38Down','direction','left'}, {'KeyboardCraftspersonKey39Down','direction','right'},
 {'KeyboardMoveForwardKeyDown','direction','up'}, {'KeyboardMoveBackwardKeyDown','direction','down'},
 {'KeyboardMoveLeftKeyDown','direction','left'}, {'KeyboardMoveRightKeyDown','direction','right'},
 {'ControllerJumpKeyDown','confirm'}, {'ControllerNormalAttackKeyDown','back'},
 {'ControllerInteractKeyDown','details'}, {'ControllerCharacterSkill2KeyDown','options'},
 {'ControllerCharacterSkill3KeyDown','direction','up'}, {'ControllerCharacterSkill4KeyDown','direction','right'},
 {'ControllerCraftspersonKey1Down','direction','left'}, {'ControllerCraftspersonKey2Down','direction','down'},
}
function N.list(buttons)
 local list={};for _,b in ipairs(buttons) do if b.selectable and not b.background then b.navIndex=#list;list[#list+1]=b end end;return list
end
function N.normalize(list,focus)
 if list[focus+1] and not list[focus+1].disabled then return focus end
 for i,b in ipairs(list) do if not b.disabled then return i-1 end end;return 0
end
function N.next(list,focus,direction)
 focus=N.normalize(list,focus);local a=list[focus+1];if not a then return focus end
 local horizontal=direction=='left' or direction=='right';local sign=(direction=='left' or direction=='up') and -1 or 1
 local best,score=nil,math.huge
 for i,b in ipairs(list) do if i~=focus+1 and not b.disabled then
  local dx=(b.x+b.w/2)-(a.x+a.w/2);local dy=(b.y+b.h/2)-(a.y+a.h/2)
  local along=(horizontal and dx or dy)*sign;local across=math.abs(horizontal and dy or dx)
  if along>1 then local value=along+across*5;if value<score then best=i-1;score=value end end
 end end
 if best~=nil then return best end
 -- At a boundary wrap along the same row/column, never to an unrelated action.
 score=math.huge
 for i,b in ipairs(list) do if i~=focus+1 and not b.disabled then
  local dx=(b.x+b.w/2)-(a.x+a.w/2);local dy=(b.y+b.h/2)-(a.y+a.h/2)
  local across=math.abs(horizontal and dy or dx);local along=(horizontal and dx or dy)*sign
  if across<math.max(horizontal and a.h or a.w,32)/2 and along<0 then local value=along+across*5;if value<score then best=i-1;score=value end end
 end end;return best or focus
end
function N.stick(x,y)
 if math.max(math.abs(x),math.abs(y))<.55 then return nil end
 if math.abs(x)>math.abs(y) then return x<0 and 'left' or 'right' end
 return y>0 and 'up' or 'down'
end
return N
