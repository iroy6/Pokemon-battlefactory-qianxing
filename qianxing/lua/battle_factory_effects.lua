local require=require("default_import_file/workspace/battle-factory/lua/battle_factory_common_fx")
-- Same move families, palettes and trajectories as prototype/effects.js.
local C=require('default_import_file/workspace/battle-factory/lua/battle_factory_effect_data')
local V={}
local X=require('default_import_file/workspace/battle-factory/lua/battle_factory_move_fx')
local function line(g,x,y,xx,yy,c,width)
 local n=math.max(1,math.ceil(math.max(math.abs(xx-x),math.abs(yy-y))/3));for i=0,n do g:rect(math.floor((x+(xx-x)*i/n)/2)*2,math.floor((y+(yy-y)*i/n)/2)*2,width or 3,width or 3,c) end
end
local function ring(g,x,y,r,c)for i=0,23 do local a=i*math.pi/12;g:rect(x+math.cos(a)*r,y+math.sin(a)*r*.7,3,3,c) end end
function V.move(g,event,t)
 local kind=C.families[event.move] or 'impact';local side=event.side;local source=side==0 and {202,291} or {550,156};local target=C.self[event.move] and source or side==0 and {550,156} or {202,291};local ax,ay=source[1],source[2];local x,y=target[1],target[2];local colors=C.styles[kind] or C.styles.impact;local light,dark=colors[1],colors[2]
 if ({flame=true,water=true,leaf=true,poison=true,powder=true,ice=true,ghost=true,dragon=true,copy=true,star=true})[kind] then
  for i=0,11 do local u=math.max(0,math.min(1,t*1.65-i*.035));if u>0 and u<1 then local xx=ax+(x-ax)*u;local yy=ay+(y-ay)*u+math.sin(u*9+i)*10;g:rect(xx,yy,kind=='flame' and 10 or 7,kind=='flame' and 10 or 7,dark);g:rect(xx-1,yy-3,5,5,light);if kind=='water' then ring(g,xx,yy,5,light) elseif kind=='leaf' then line(g,xx-5,yy+3,xx+5,yy-3,dark) elseif kind=='ice' or kind=='star' then line(g,xx-7,yy,xx+7,yy,light);line(g,xx,yy-7,xx,yy+7,light) end end end
  if t>.5 then for i=0,7 do local a=i*math.pi/4;g:rect(x+math.cos(a)*(t-.5)*95,y+math.sin(a)*(t-.5)*75,5,5,i%2==0 and dark or light) end end
 elseif kind=='electric' then for bolt=0,2 do local px,py=ax,ay;for j=1,9 do local nx=ax+(x-ax)*j/9;local ny=ay+(y-ay)*j/9+math.sin(j*7+math.floor(t*15)+bolt)*16;line(g,px,py,nx,ny,bolt==0 and dark or light,bolt==0 and 5 or 2);px=nx;py=ny end end
 elseif kind=='slash' then for i=0,2 do line(g,x-30+i*15,y-26,x-30+i*15+math.min(1,t*2)*48,y-26+math.min(1,t*2)*58,dark,7) end
 elseif kind=='bite' then local gap=(1-math.sin(t*math.pi))*25+5;for i=-2,2 do for j=0,5 do g:rect(x+i*13-j,y-gap-12+j*2,2*j+2,2,light);g:rect(x+i*13-j,y+gap+12-j*2,2*j+2,2,light) end end
 elseif kind=='impact' then for i=0,7 do local a=i*math.pi/4;local r=10+t*26;line(g,x+math.cos(a)*r,y+math.sin(a)*r,x+math.cos(a)*(r+16),y+math.sin(a)*(r+16),i%2==0 and dark or light,5) end
 elseif kind=='rock' or kind=='dig' then for i=0,8 do local u=math.min(1,t*1.5-i*.035);local xx=x+(i%3-1)*25;local yy=kind=='dig' and y+26-math.sin(u*math.pi)*30 or y-76+u*110;g:rect(xx,yy,14,14,dark);g:rect(xx-2,yy-2,8,8,light) end
 elseif kind=='shield' or kind=='vine' then for i=0,3 do ring(g,x,y-24+i*12,kind=='vine' and math.max(8,50-t*34) or 30+i*14+math.sin(t*math.pi)*10,i%2==0 and dark or light) end
 elseif kind=='heal' or kind=='boost' then for i=0,8 do local xx=x+math.sin(i*3)*36;local yy=y+40-(t*90+i*12)%90;line(g,xx-6,yy,xx+6,yy,light);line(g,xx,yy-6,xx,yy+6,light) end
 elseif kind=='sound' or kind=='psychic' or kind=='wind' then for i=0,3 do local u=(t+i*.2)%1;ring(g,ax+(x-ax)*u,ay+(y-ay)*u,8+u*40,i%2==0 and dark or light) end
 elseif kind=='sun' then ring(g,540,55,35,'#ffd35b');g:rect(527,42,26,26,'#fff0a0')
 elseif kind=='sand' or kind=='weather' or kind=='terrain' then for i=1,27 do local xx=(i*57+t*350)%720;local yy=kind=='terrain' and 315+i%3*8 or (i*31+t*160)%345;g:rect(xx,yy,kind=='weather' and 2 or 5,kind=='weather' and 14 or 5,kind=='terrain' and '#ffe45f' or kind=='sand' and '#caa66e' or light) end
 else for i=0,8 do g:rect(x+math.cos(i*.7+t*5)*36,y+math.sin(i*.7+t*5)*24,6,6,i%2==0 and light or dark) end end
end
function V.field(g,conditions,vol,x,y,t)
 conditions=conditions or {};vol=vol or {}
 local offset=0
 for _,name in ipairs({'reflect','lightscreen'}) do
  if conditions[name] and conditions[name]~=0 then X.screen(g,name,x+offset,y-28,t,.16+.03*math.sin(t*1.5),true);offset=offset+(x<360 and 15 or -15) end
 end
 if conditions.safeguard and conditions.safeguard~=0 then X.stamp(g,'protect',x,y-28,100,0,.1) end
 if conditions.mist and conditions.mist~=0 then for i=0,5 do g:rect(x-80+math.sin(t*2+i)*8,y-5+i*4,160,3,'#ffffff55') end end
 if conditions.tailwind and conditions.tailwind~=0 then for i=0,5 do local xx=x-100+(t*90+i*29)%170;g:rect(xx,y-82+i*15,36,2,'#e2fff7bb') end end
 if conditions.stealthrock and conditions.stealthrock~=0 then for i=0,4 do local xx=x-65+i*31;local yy=y+10+math.sin(t*3+i)*4;g:rect(xx,yy,10,13,'#665641');g:rect(xx+2,yy+2,6,9,'#9b8361') end end
 for _,k in ipairs({'watersport','mudsport'}) do if vol[k] and vol[k]~=0 then for i=0,4 do local xx=x-64+i*30;local yy=y+9-(t*25+i*11)%52;g:rect(xx,yy,8,8,k=='watersport' and '#b4eafaaa' or '#a8895aaa') end end end
end
function V.status(g,status,x,y,t,alpha)
 alpha=alpha or 1
 if status=='brn' or status=='psn' or status=='tox' or status=='par' or status=='frz' then
  local name=status=='brn' and 'fire_plume' or status=='par' and 'electricity' or status=='frz' and 'ice_chunk' or status=='tox' and 'toxic_bubble' or 'poison_bubble'
  for i=0,3 do local p=(t*.65+i*.24)%1;X.stamp(g,name,x+(i-1.5)*20+math.sin(t*2+i)*3,y-12-p*53,23,p,math.sin(p*math.pi)*.85*alpha) end;return
 end
 if status=='slp' then for i=1,3 do g:text('Z',x-20+i*16,y-(t*25+i*18)%75,12+i*3,{97,117,150,math.floor(alpha*255)}) end
 elseif status=='par' then for i=1,4 do local xx=x+(i-2)*15;local yy=y-35+math.sin(t*10+i)*15;line(g,xx,yy,xx+8,yy+10,'#efcf39');line(g,xx+8,yy+10,xx,yy+23,'#f8e99b') end
 elseif status=='frz' then for i=1,6 do local xx=x+(i-3)*11;local yy=y-20+math.sin(t*2+i)*10;g:rect(xx,yy,9,19,'#9ce1eab0');g:rect(xx+2,yy+2,3,13,'#e4ffffb0') end
 elseif status=='brn' then for i=1,6 do local yy=y-(t*40+i*9)%64;g:rect(x+(i-3)*9,yy,7,9,'#df6837');g:rect(x+(i-3)*9+2,yy+3,3,4,'#ffdf77') end
 elseif status=='psn' or status=='tox' then for i=1,5 do local xx=x+(i-3)*11+math.sin(t*4+i)*4;local yy=y-(t*24+i*12)%55;g:rect(xx,yy,7,7,status=='tox' and '#6e3695' or '#a45bb8');g:rect(xx+1,yy+1,2,2,'#e2b6ee') end end
end
local Feedback=require('default_import_file/workspace/battle-factory/lua/battle_factory_feedback')
V.eventDuration=Feedback.animation;V.event=Feedback.draw;V.textDuration=Feedback.duration
V.move=X.move;V.duration=X.duration;V.hit=X.hit;V.prewarm=X.prewarm
return V
