local require=require("default_import_file/workspace/battle-factory/lua/battle_factory_common_fx")
local P='default_import_file/workspace/battle-factory/lua/'
local A=require(P..'art/battle_fx')
local index=require(P..'art/move_index')
local X={};local active,sequence
local function clamp(x)return math.max(0,math.min(1,x)) end
function X.stamp(g,name,x,y,size,phase,alpha)
 local a=A[name];if not a then return end
 local count=#a.timeline/2;local frame=a.timeline[math.min(count,1+math.floor(clamp(phase or 0)*(count-1)))*2-1]
 local w=size or a.w;local h=w*a.h/a.w
 g:sprite(a,x-w/2,y-h/2,w,h,frame,math.floor(clamp(alpha or 1)*255))
end
function X.screen(g,move,x,y,t,alpha,persistent)
 local name=move=='reflect' and 'blue_light_wall' or move=='barrier' and 'gray_light_wall' or 'green_light_wall'
 X.stamp(g,name,x+(x<360 and 1 or -1)*(persistent and 55 or 40),y-10,persistent and 66 or 102,0,alpha)
end
function X.hit(g,side,t)
 X.stamp(g,'impact',side==0 and 185 or 565,side==0 and 268 or 150,62*(.7+.5*math.sin(t*math.pi)),t,math.sin(t*math.pi))
end
function X.duration(move)return index[move] or 1.08 end
function X.prewarm()end
function X.move(g,e,t)
 if not index[e.move] then return end
 if active~=e.move then active=e.move;sequence=require(P..'art/move_'..active) end
 local rows=sequence[(e.side or 0)*2+(e.miss and 2 or 1)]
 local commands=rows[math.min(#rows,1+math.floor(clamp(t)*(#rows-1)))]
 for _,r in ipairs(commands) do
  if r[1]==1 then
   local a=A[r[2]];g:sprite(a,r[4]-r[6]/2,r[5]-r[7]/2,r[6],r[7],a.timeline[r[3]*2-1],r[9],r[8])
  elseif r[1]==2 then g:line(r[2],r[3],r[4],r[5],r[6],r[7])
  elseif r[1]==3 then g:ellipse(r[2],r[3],r[4],r[5],r[6]) end
 end
end
return X
