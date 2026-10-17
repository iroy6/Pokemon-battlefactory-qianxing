local require=require("default_import_file/workspace/battle-factory/lua/battle_factory_common_fx")
-- Pixel-font, wrapped transcript; only visible lines own image controls.
local H={lineHeight=27,height=348,width=642,size=16};H.__index=H
function H.new(rows,iter,graphics)
 local self=setmetatable({lines={},offset=0},H)
 for _,row in iter(rows) do
  for _,text in ipairs(graphics.lines(row.text,H.size,H.width)) do self.lines[#self.lines+1]={text=text,kind=row.kind} end
 end
 self.maximum=math.max(0,#self.lines*H.lineHeight-H.height)
 return self
end
function H:scroll(delta,absolute)
 local next=math.max(0,math.min(self.maximum,absolute or self.offset+delta))
 if math.abs(next-self.offset)<.1 then return false end
 self.offset=next;return true
end
function H:draw(g)
 g:begin();local first=math.floor(self.offset/H.lineHeight)+1
 for i=first,math.min(#self.lines,first+math.ceil(H.height/H.lineHeight)) do local row=self.lines[i]
  g:text(row.text,0,(i-1)*H.lineHeight-self.offset,H.size,row.kind=='match' and '#83509a' or row.kind=='turn' and '#536f65' or '#41444b',H.width,nil,1)
 end
 if #self.lines==0 then g:text('还没有战斗记录。',0,0,H.size,'#41444b') end
 g:finish()
end
return H
