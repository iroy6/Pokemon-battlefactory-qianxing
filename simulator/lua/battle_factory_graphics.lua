-- Retained image/rectangle pool. Only changed properties cross the Lua bridge.
-- Preview texture bindings are local; portable rectangle art remains available.
local G={scale=1,height=480};G.__index=G
local P='default_import_file/simulator/lua/'
local font=require(P..'art/font')
local alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
local b64={};for i=1,#alphabet do b64[alphabet:byte(i)]=i-1 end
local function decode(s)
 local out={};for i=1,#s,4 do local a,b,c,d=b64[s:byte(i)] or 0,b64[s:byte(i+1)] or 0,b64[s:byte(i+2)] or 0,b64[s:byte(i+3)] or 0
 out[#out+1]=string.char(a*4+math.floor(b/16));if s:sub(i+2,i+2)~='=' then out[#out+1]=string.char(b%16*16+math.floor(c/4)) end;if s:sub(i+3,i+3)~='=' then out[#out+1]=string.char(c%4*64+d) end end;return table.concat(out)
end
local colors={}
function G.color(c)
 if type(c)=='table' then local key=c[1]*16777216+c[2]*65536+c[3]*256+(c[4] or 255);if not colors[key] then colors[key]=Color(c[1],c[2],c[3],c[4] or 255) end;return colors[key] end
 if colors[c] then return colors[c] end
 local raw=c:gsub('#','');local v=Color(tonumber(raw:sub(1,2),16),tonumber(raw:sub(3,4),16),tonumber(raw:sub(5,6),16),tonumber(raw:sub(7,8),16) or 255);colors[c]=v;return v
end
local bounds=setmetatable({},{__mode='k'})
function G.bounds(c,x,y,w,h)
 local old=bounds[c]
 if not old then old={};bounds[c]=old end
 if old.x~=x or old.y~=y then c:SetAnchoredPosition(x,y);old.x=x;old.y=y end
 if old.w~=w or old.h~=h then c:SetSizeDelta(w,h);old.w=w;old.h=h end
end
function G.box(c,x,y,w,h,exact,height)
 height=height or G.height
 -- A glyph must keep one scale on both axes. Rounding each glyph's four
 -- edges independently makes adjacent Chinese strokes alternate in width.
 if exact then G.bounds(c,x*G.scale,(height-y-h)*G.scale,w*G.scale,h*G.scale);return end
 local s=G.scale;local l=math.floor(x*s+.5);local b=math.floor((height-y-h)*s+.5);local r=math.floor((x+w)*s+.5);local t=math.floor((height-y)*s+.5)
 G.bounds(c,l,b,r-l,t-b)
end
function G.new(parent,name,height)return setmetatable({parent=parent,rects={},used=0,name=name or 'ui',height=height or 480,textRuns={}},G) end
function G:begin()self.used=0;self.activeTextRun=nil end
function G:texture(image,x,y,w,h,color,exact)
 if w<=0 or h<=0 then return end
 self.used=self.used+1;local slot=self.rects[self.used]
 if not slot then
  local c=game.InstantiateClientUIControl(1073742110,self.parent);c.name=self.name..'-'..self.used;c:SetActive(true)
  c:SetAnchorMin(0,0);c:SetAnchorMax(0,0);c:SetPivot(0,0);slot={c=c,visible=true};self.rects[self.used]=slot
 end
 local c=slot.c
 slot.textRun=self.activeTextRun
 if not slot.visible then c:SetVisible(true);slot.visible=true end
 if slot.x~=x or slot.y~=y or slot.w~=w or slot.h~=h or slot.exact~=exact then G.box(c,x,y,w,h,exact,self.height);slot.x=x;slot.y=y;slot.w=w;slot.h=h;slot.exact=exact end
 if slot.image~=image then c:SetImage(Enum.ImageSource.StaticReference,image);slot.image=image end
 color=color or '#ffffff';local key=type(color)=='table' and color[1]*16777216+color[2]*65536+color[3]*256+(color[4] or 255) or color;if slot.color~=key then c.imageColor=G.color(color);slot.color=key end
end
function G:rect(x,y,w,h,color)self:texture(100001,x,y,w,h,color) end
function G:finish()
 -- Only the tail that was visible in the previous pass can become stale.
 -- Scanning the whole retained pool is especially costly on the gallery page,
 -- where one frame owns thousands of rectangle controls.
 local previous=self.lastUsed or #self.rects
 for i=self.used+1,previous do local slot=self.rects[i];if slot and slot.visible then slot.c:SetVisible(false);slot.visible=false end end
 self.lastUsed=self.used
end
function G:panel(x,y,w,h,fill,border)
 self:rect(x,y,w,h,border or '#77748a');self:rect(x+3,y+3,w-6,h-6,'#d9d9e1');self:rect(x+6,y+6,w-12,h-12,fill or '#fffef6')
end
function G:ellipse(x,y,w,h,color)
 for yy=0,math.ceil(h/2)-1 do local v=(yy*2+1-h/2)/(h/2);local ww=math.floor(math.sqrt(math.max(0,1-v*v))*w/2)*2
  self:rect(x+(w-ww)/2,y+yy*2,ww,math.min(2,h-yy*2),color)
 end
end
function G:triangle(x,y,w,h,color,direction)
 for k=0,math.ceil(h/2)-1 do local ww=math.floor((k+1)*2/h*w);self:rect(x+(w-ww)/2,direction=='down' and y+h-k*2-2 or y+k*2,ww,2,color) end
end
local function clean(text)return tostring(text or ''):gsub('(%d+)%.0([^%d])','%1%2'):gsub('(%d+)%.0$','%1') end
function G.measure(text,size)
 local w=0;for _,cp in utf8.codes(clean(text)) do local glyph=font[utf8.char(cp)] or font['?'];if glyph then w=w+glyph[1] end end;return w*(size or 18)/12
end
function G.lines(text,size,width)
 local lines,line,w={},'',0;local scale=(size or 18)/12
 for _,cp in utf8.codes(clean(text)) do local ch=utf8.char(cp);local glyph=font[ch] or font['?'];local advance=glyph and glyph[1]*scale or 0
  if cp==10 then lines[#lines+1]=line;line='';w=0
  else if width and w+advance>width and #line>0 then lines[#lines+1]=line;line='';w=0 end;line=line..ch;w=w+advance end
 end;lines[#lines+1]=line;return lines
end
function G:text(text,x,y,size,color,width,align,maxLines)
 -- A retained label whose slots have not been overwritten needs no UTF-8
 -- layout or bridge calls. One entry per pool position bounds cache growth.
 local start=self.used+1;local cached=self.textRuns[start]
 if cached and cached.text==text and cached.x==x and cached.y==y and cached.size==size and cached.color==color and cached.width==width and cached.align==align and cached.maxLines==maxLines and cached.scale==G.scale and cached.textures==G.textures then
  local intact=true;for i=start,cached.last do local slot=self.rects[i];if not slot or slot.textRun~=cached or not slot.visible then intact=false;break end end
  if intact then self.used=cached.last;return cached.bottom end
 end
 local run={text=text,x=x,y=y,size=size,color=color,width=width,align=align,maxLines=maxLines,scale=G.scale,textures=G.textures};self.activeTextRun=run
 local scale=(size or 18)/12;local lines=G.lines(text,size,width);color=color or '#41444b'
 for i,line in ipairs(lines) do if maxLines and i>maxLines then break end
  local xx=x;if align=='center' then xx=x+((width or 0)-G.measure(line,size))/2 elseif align=='right' then xx=x+(width or 0)-G.measure(line,size) end
  for _,cp in utf8.codes(line) do local glyph=font[utf8.char(cp)] or font['?'];if glyph then
   if glyph.id and G.textures~=false then if cp~=32 then self:texture(glyph.id,xx,y+(i-1)*16*scale,glyph[1]*scale,16*scale,color,true) end
   else
    for yy=0,15 do local bits=glyph[yy+2] or 0;local gx=0;while gx<glyph[1] do if math.floor(bits/2^gx)%2==1 then local start=gx;repeat gx=gx+1 until gx>=glyph[1] or math.floor(bits/2^gx)%2==0;self:rect(xx+start*scale,y+(i-1)*16*scale+yy*scale,(gx-start)*scale,scale,color) else gx=gx+1 end end end
   end;xx=xx+glyph[1]*scale
  end end
 end;self.activeTextRun=nil;run.last=self.used;run.bottom=y+math.min(#lines,maxLines or #lines)*16*scale;self.textRuns[start]=run;return run.bottom
end
function G:image(art,x,y,scale,frame,tint)
 if not art then return end;frame=frame or 1
 if art.ids then self:texture(art.ids[frame],x,y,art.w*scale,art.h*scale,tint);return end
 art.decoded=art.decoded or {};local bytes=art.decoded[frame];if not bytes then bytes=decode(art.frames[frame]);art.decoded[frame]=bytes end
 for i=1,#bytes,6 do local xx,yy,w,h,hi,lo=bytes:byte(i,i+5);self:rect(x+xx*scale,y+yy*scale,w*scale,h*scale,art.palette[hi*256+lo+1]) end
end
function G.frame(art,t)
 if not art.total then local total=0;art.ends={};for i=2,#art.timeline,2 do total=total+art.timeline[i];art.ends[#art.ends+1]=total end;art.total=total end
 local ms=(t*1000)%math.max(1,art.total);local lo,hi=1,#art.ends;while lo<hi do local m=math.floor((lo+hi)/2);if ms<art.ends[m] then hi=m else lo=m+1 end end;return art.timeline[lo*2-1] or 1
end
return G
