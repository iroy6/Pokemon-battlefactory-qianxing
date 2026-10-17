local P='default_import_file/simulator/lua/'
local D=require(P..'battle_factory_feedback_data')
local R=require(P..'art/recovery');local A=require(P..'art/battle_fx')
local F={}
function F.duration(e,animation)
 local text=D.text
 if e.kind=='turn' then return text.turn end
 if e.kind=='damage' then return math.max(animation or 0,text.damage) end
 local cleaned=(e.text or ''):gsub('%s','');local n=utf8.len(cleaned) or 0
 return math.max(animation or 0,math.min(text.max,math.max(text.min,text.base+n*text.perChar)))
end
function F.animation(kind)return D.durations[kind] end
function F.draw(g,e,t)
 local frames=D.frames[e.kind];if not frames or (e.side~=0 and e.side~=1) then return end
 local rows=frames[math.min(#frames,1+math.floor(math.max(0,t)*(#frames-1)))]
 local x,y=e.side==0 and 185 or 565,e.side==0 and 268 or 150
 for _,r in ipairs(rows) do
  local name=r[1]=='item' and (R[e.item] and e.item or 'item_bag') or r[1]
  local a=R[name] or A[name]
  if a then local frame=math.min(#a.ids,1+math.floor(r[5]*(#a.ids-1)));local scale=r[4]/math.max(a.w,a.h);local w,h=a.w*scale,a.h*scale
   g:texture(a.ids[frame],x+r[2]*(e.side==0 and 1 or -1)-w/2,y+r[3]-h/2,w,h,{255,255,255,math.floor(r[6]*255)})
  end
 end
end
return F
