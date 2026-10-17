local require=require("default_import_file/workspace/battle-factory/lua/battle_factory_common_fx")
-- 720x480 game interface; rules are in battle_factory_core.
local P='default_import_file/workspace/battle-factory/lua/'
local F=require(P..'battle_factory_core');local G=require(P..'battle_factory_graphics');local V=require(P..'battle_factory_effects')
local Random=require(P..'battle_factory_random')
local N=require(P..'battle_factory_input')
local H=require(P..'battle_factory_history')
local PREVIEW=require(P..'art/preview');G.textures=PREVIEW.enabled
local MAP=require(P..'battle_factory_mapping')
local ICON=PREVIEW.enabled and PREVIEW.icons or require(P..'art/icons')
local E,D,M,I=F.engine,F.data,F.meta,F.info;local call=F.call
local state,stage,ui,fx,moveFx,hostScript,buttonLayer,modalStage,modalUI
local gameOverSignal,gameOverSent=nil,false
local buttons,hitboxes,sprites,artCache={},{},{},{}
local viewScale,offsetX,offsetY,canvasW,canvasH=1,0,0,1280,720
local focus,rentalFocus,detailPage,summaryMove,swapOwn,swapFoe=0,0,0,0,-1,-1
local fieldPages=2
local menu,overlay='root',nil
local replaySeed=nil;local clock=0;local queue=nil;local queueIndex=0;local eventClock=0;local shown=nil;local message='';local headline='';local motion=true;local sound=false
local display,eventBefore,hpSlots={},nil,{};local eventDuration=1;local animationDuration=1;local startEvent;local moveEffect=nil
local switchRecall=false;local switchEntering=false;local curePending=false
local lastPlayback=nil;local introBattle=nil
local draw,dispatch,back,confirm
local history,historyViewport,historyUI,historyBar,scrollHistory
local inputMode,stickDirection,stickClock,lastDevice='keyboard',nil,0,nil
local function deviceMode()
 local d=game.GetDevice();return (d==Enum.Device.Controller or d==Enum.Device.MobileController) and 'controller' or d==Enum.Device.Mobile and 'touch' or 'keyboard'
end
local function hint()
 return inputMode=='touch' and '点击选择　A 确认　B 返回' or inputMode=='controller' and '方向键 / 摇杆选择　A 确认　B 返回　X 说明　Y 菜单' or '方向键 / WASD 选择　Z 确认　X 返回　Y 说明　Tab 菜单'
end
local function forcedTeam()return overlay and overlay.kind=='team' and state.phase=='battle' and state.battle.phase=='forced' end
local ink,paper='#41444b','#fffef6'
local weatherZh={sun='晴天',rain='下雨',sandstorm='沙暴',hail='冰雹'}
local statusColor={psn='#a45bb8',tox='#873fa3',brn='#d95d3d',par='#b99b21',slp='#657b91',frz='#57a3bd'}
local typeNames={Normal='一般',Fire='火',Water='水',Electric='电',Grass='草',Ice='冰',Fighting='格斗',Poison='毒',Ground='地面',Flying='飞行',Psychic='超能力',Bug='虫',Rock='岩石',Ghost='幽灵',Dragon='龙',Dark='恶',Steel='钢',Fairy='妖精',Physical='物理',Special='特殊',Status='变化'}
local function newChallenge()
 local seed
 if replaySeed~=nil then seed=replaySeed;replaySeed=replaySeed+1 else seed=Random.nextSeed() end
 print('factory-seed',seed)
 return F.new(E.Factory,seed,F.null)
end
local function sendGameOver()
 if gameOverSent then return end
 gameOverSignal=gameOverSignal or game.ServerSignal('game_over')
 gameOverSignal:SendSignal()
 gameOverSent=true
 print('factory-game-over-sent','game_over')
end
local function id(s)return (string.lower(tostring(s)):gsub('[^a-z0-9]','')) end
local function art(num,view)
 if PREVIEW.enabled then return PREVIEW.sprites[num][view or 'front'] or PREVIEW.sprites[num].front end
 if not artCache[num] then artCache[num]=require(P..'art/mon_'..num) end;return artCache[num][view or 'front'] or artCache[num].front
end
local function container(name,parent)
 local c=parent:GetChild(name) or game.InstantiateClientUIControl(MAP.container,parent);assert(c,'Missing container template '..MAP.container);c.name=name;c:SetActive(true);c:SetAnchorMin(0,0);c:SetAnchorMax(0,0);c:SetPivot(0,0);c:SetSizeDelta(720,480);c:SetAnchoredPosition(0,0);return c
end
local function hit(label,key,index,x,y,w,h,disabled,selectable)
 local k=#buttons+1;local b={key=key,index=index,label=label,disabled=disabled,selectable=selectable,x=x,y=y,w=w,h=h};buttons[k]=b
 local slot=hitboxes[k];if not slot then local c=game.InstantiateClientUIControl(MAP.input,buttonLayer);c:SetActive(true);c:SetAnchorMin(0,0);c:SetAnchorMax(0,0);c:SetPivot(0,0);slot={c=c};hitboxes[k]=slot
  c:AddCursorEventListener(Enum.CursorEventType.CursorClick,function()local action=buttons[k];if action and not action.disabled then inputMode=deviceMode();if action.navIndex then focus=action.navIndex end;dispatch(action.key,action.index) end end)
  c:AddCursorEventListener(Enum.CursorEventType.CursorEnter,function()local action=buttons[k];if action and action.key=='move' and not action.disabled and not queue and focus~=action.index then focus=action.index;draw() end end)
  c:AddCursorEventListener(Enum.CursorEventType.CursorDrag,function(e)local action=buttons[k];if action and not action.disabled and action.key=='history-scroll' then local _,dy=e:GetUIPosDelta();scrollHistory(dy/viewScale) elseif action and not action.disabled and action.key=='history-bar' then local _,y=e:GetUIPos();scrollHistory(0,(480-(y-offsetY)/viewScale-66)/H.height*(history and history.maximum or 0)) end end)
  c:AddCursorEventListener(Enum.CursorEventType.CursorDown,function(e)local action=buttons[k];if action and not action.disabled and action.key=='history-bar' then local _,y=e:GetUIPos();scrollHistory(0,(480-(y-offsetY)/viewScale-66)/H.height*(history and history.maximum or 0)) end end)
 end
 local c=slot.c;c.name='action-'..key..(index~=nil and '-'..index or '');G.bounds(c,offsetX+x*viewScale,offsetY+(480-y-h)*viewScale,w*viewScale,h*viewScale);c.raycastTarget=not disabled;c:SetVisible(true)
end
local function cursor(x,y,c)
 for row=0,8 do local w=(row<5 and row+1 or 9-row)*2;ui:rect(x,y+row*2,w,2,c or ink) end
end
local function textButton(label,key,index,x,y,w,h,chosen,disabled,size)
 if chosen then ui:rect(x,y,w,h,'#eeebda');cursor(x+8,y+(h-18)/2) end
 ui:text(label,x+27,y+(h-(size or 23)*4/3)/2,size or 23,disabled and '#92988e' or ink,w-33,nil,1);hit(label,key,index,x,y,w,h,disabled,true)
end
local function button(label,key,index,x,y,w,h,disabled)
 ui:panel(x,y,w,h,disabled and '#d7d9c9' or paper);ui:text(label,x+8,y+(h-24)/2,18,disabled and '#92988e' or ink,w-16,'center',1);hit(label,key,index,x,y,w,h,disabled,true)
end
local function showSprite(num,view,x,y,w,h,bottom,side)
 local a=art(num,view);h=h or w;local s=math.min(w/a.w,h/a.h);local px=x+(w-a.w*s)/2;local py=bottom and y+h-a.h*s or y+(h-a.h*s)/2
 local frame=motion and view~='icon' and G.frame(a,clock) or 1
 -- Returning from a menu must not repaint twelve animation frames at once.
 local previous=ui.rects[ui.used+1]
 if state.phase=='division' and motion and previous and previous.art==a and previous.frame then frame=previous.frame end
 local nativeSlot=ui:image(a,px,py,s,frame);sprites[#sprites+1]={art=a,slot=nativeSlot,x=px,y=py,scale=s,last=frame,side=side,static=view=='icon',modal=ui==modalUI}
end
local spriteCursor=0
local function updateSprites()
 -- Spread the twelve gallery sprites across updates. Each keeps its original
 -- timeline; modal/battle sprites are updated immediately.
 local gallery=state.phase=='division' and not overlay;local refreshed=0
 local count=#sprites
 for i=1,count do
  local s=sprites[gallery and ((spriteCursor+i-1)%count+1) or i]
  if not overlay or s.modal then
  local f=motion and not s.static and G.frame(s.art,clock) or 1;if f~=s.last and (not gallery or refreshed<2) then G.renderSprite(s.slot,s.art,f,s.alpha or 255);s.last=f;refreshed=refreshed+1 end
  if s.side~=nil then
   local dx,dy,scale,alpha=0,0,1,255;local p=math.max(0,math.min(1,(eventDuration-eventClock)/animationDuration));local side=s.side
   if queue and shown and motion then local k=shown.kind
    if k=='move' and side==shown.side then local m=M.moves[shown.move];if m and m.category=='Physical' then local bump=math.sin(math.min(1,p/.65)*math.pi);dx=(side==0 and 15 or -15)*bump;dy=(side==0 and -6 or 6)*bump end
     local id=shown.move;local wave=math.sin(p*math.pi)
     if id=='agility' or id=='doubleteam' then dx=math.sin(p*math.pi*8)*24*wave
     elseif id=='minimize' or id=='defensecurl' or id=='withdraw' then scale=1-wave*(id=='minimize' and .55 or .28)
     elseif id=='acidarmor' then scale=1-wave*.25;alpha=math.floor(255-wave*105)
     elseif id=='tailwhip' then dx=math.sin(p*math.pi*6)*12*wave
     elseif id=='quiverdance' or id=='dragondance' then dx=math.sin(p*math.pi*4)*10*wave;dy=-wave*8
     elseif id=='calmmind' then dy=-wave*5
     elseif id=='feintattack' then alpha=math.floor(255*(1-.8*wave)) end
    elseif k=='damage' and side==shown.side then dx=math.sin(p*math.pi*8)*6*(1-p)
    elseif k=='faint' and side==shown.side then dy=42*p;alpha=math.floor(255*(1-p))
    elseif k=='charge' and side==shown.side then dy=40*p;alpha=math.floor(255*(1-p))
    elseif k=='switch' and switchEntering and side==shown.side then
     if switchRecall and p<.35 then scale=1-p/.35*.9;alpha=math.floor(255*(1-p/.35))
     else local q=switchRecall and (p-.35)/.65 or p;scale=.1+.9*math.sin(q*math.pi/2);alpha=math.floor(255*math.min(1,q*3)) end
    end
    if k=='move' and (shown.move=='earthquake' or shown.move=='magnitude') then dx=math.sin(p*math.pi*18)*5*math.sin(p*math.pi) end
   end
   local w,h=s.art.w*s.scale,s.art.h*s.scale
   if s.dx~=dx or s.dy~=dy or s.poseScale~=scale then G.poseSprite(s.slot,s.x+dx+w*(1-scale)/2,s.y+dy+h*(1-scale),w*scale,h*scale,0,alpha);s.dx=dx;s.dy=dy;s.poseScale=scale end
   if s.alpha~=alpha then G.renderSprite(s.slot,s.art,s.last,alpha);s.alpha=alpha end
  end
  end
 end
 if gallery and count>0 then spriteCursor=(spriteCursor+2)%count end
 if queue and shown and (shown.kind=='damage' or shown.kind=='heal') and eventBefore then local side=shown.side;local before=eventBefore[side];local after=display[side];local p=math.min(1,((eventDuration-eventClock)/animationDuration)/.8)
  if before and after then local ratio=(before.hp+(after.hp-before.hp)*p)/after.maxhp;for _,h in ipairs(hpSlots[side] or {}) do G.box(h.c,h.x,h.y,math.max(.01,218*ratio),h.h) end end
 end
end
local function icon(name,x,y,w,h,tint)
 local a=ICON[name];if not a then return end;if a.ids then ui:texture(a.ids[1],x,y,w or a.w,h or a.h,tint) else ui:image(a,x,y,math.min((w or a.w)/a.w,(h or a.h)/a.h),1,tint) end
end
local function badge(t,x,y,caption,color)
 local category=t=='Physical' or t=='Special' or t=='Status';local w=category and 32 or 48;local h=category and 14 or 16
 local a=ICON[t];if a then ui:image(a,x,y,math.min(w/a.w,h/a.h),1) end
 if caption~=false then ui:text(typeNames[t] or t,x+w+5,y-1,14,color or '#354e61') end
 return w+5+G.measure(typeNames[t] or t,14)
end
local function types(m,x,y,center,color)
 local widths,total={},0;for i,t in F.iter(m.types) do widths[i]=53+G.measure(typeNames[t] or t,14);total=total+widths[i]+(i>0 and 10 or 0) end
 if center then x=x-total/2 end
 for i,t in F.iter(m.types) do badge(t,x,y,true,color);x=x+widths[i]+10 end
end
local function title(t)ui:rect(0,0,720,40,'#a55ec4');ui:rect(0,35,720,5,'#76358a');ui:text(t,18,4,23,'#ffffff',685,nil,1) end
local function foot(t)ui:rect(0,456,720,24,'#464752');ui:text(t,14,458,14,'#f3f0de',692,nil,1) end
local function terminalHead(t,name,sub,h)
 h=h or 102;ui:rect(0,0,720,h,'#030406')
 -- Rasterized 45-degree stripes from the HTML terminal header.
 for y=0,h-12,2 do local x=math.floor(.52*(720+h)-h+y);local w=math.floor(.013*(720+h));local finish=math.floor(.67*(720+h)-h+y);ui:rect(x,y,w,2,'#ffe600');ui:rect(x+w,y,finish-x-w,2,'#5b5b66');ui:rect(finish,y,w,2,'#ffe600') end
 ui:rect(0,h-12,720,12,'#ffe600');ui:text(t,18,h-54,h==80 and 26 or 28,'#ffffff',440,nil,1)
 ui:text(sub,482,h-71,14,'#eeeed7',220,'right',1);ui:text(name,482,h-47,29,'#ef241e',220,'right',1)
end
local function talk(text,x,y,w,h)
 x=x or 0;y=y or 306;w=w or 505;h=h or 92
 ui:rect(x,y,w,h,'#ffe600');ui:rect(x,y+6,w-6,h-12,'#030406');for i=0,4 do ui:rect(x+w-10+i*2,y+i*2,10-i*2,2,'#5b5b66');ui:rect(x+w-10+i*2,y+h-i*2-2,10-i*2,2,'#5b5b66') end;ui:text(text,x+16,y+14,23,'#ffffff',w-42,nil,2)
end
local function dialogue(text,x,y,w,h)
 x=x or 5;y=y or 350;w=w or 710;h=h or 105
 ui:rect(x,y,w,h,'#ce5845');ui:rect(x+7,y+7,w-14,h-14,'#a2c6ba');ui:rect(x+10,y+10,w-20,h-20,'#6ba2a2');ui:rect(x+7,y+h-10,w-14,3,'#4b777d');ui:rect(x+w-10,y+7,3,h-14,'#4b777d');ui:text(text,x+23,y+18,24,'#ffffed',w-46,nil,2)
end
local function selected(index)for _,n in F.iter(state.selected) do if n==index then return true end end;return false end
local function division()
 ui:rect(0,0,720,480,'#5b5b66');terminalHead('选择挑战级别','同级对战','50 级 / 单人单打',80)
 for i,d in F.iter(D.divisions) do local x=16+(i%2)*349;local y=92+math.floor(i/2)*143
  ui:rect(x,y,339,133,i==focus%4 and '#ffe500' or '#9699a0');ui:rect(x+4,y+4,331,125,'#464c56');ui:rect(x+6,y+6,327,121,i==focus%4 and '#24293c' or '#101419')
  ui:text(d.name,x+16,y+10,24,'#ffe500',300,nil,1);ui:text(d.description,x+16,y+39,18,'#f3edd5',310,nil,1)
  for j,n in F.iter(d.samples) do showSprite(n,'front',x+85+j*82,y+58,66,66) end
  hit(d.name,'division',d.id,x,y,339,133,false,true)
 end
 ui:rect(16,380,688,76,'#ffe500');ui:rect(20,384,680,68,'#050608');ui:text('租借三只宝可梦，挑战七连胜！\n选择适合自己的级别，开始挑战。',34,394,16,'#fffde5',650,nil,2);foot(inputMode=='touch' and '点击选择　A 确认　B 返回' or inputMode=='controller' and '方向键 / 摇杆选择　A 确认　B 返回' or '方向键 / WASD 选择　Z 确认　X 返回')
end
local function rentalStage(ms,focusIndex,action,chosen,preview)
 ui:rect(0,102,720,6,'#17191d');for y=108,252,6 do ui:rect(0,y,720,3,'#abd8df');ui:rect(0,y+3,720,3,'#7fabb9') end
 ui:rect(0,251,720,4,'#7a8d8e');ui:rect(0,255,720,5,'#f0f4ed');ui:rect(0,260,720,24,'#b7c1bf');ui:rect(0,284,720,10,'#ffe600')
 local n=ms._n;local space=n==3 and 180 or 105;local gap=(690-n*space)/(n+1)
 for i,m in F.iter(ms) do local x=15+gap+i*(space+gap);local rented=false;for _,v in ipairs(chosen or {}) do if v==i then rented=true end end
  local ball=n==3 and 108 or 90;local size=n==3 and 18 or 16;local label=G.measure(m.name,size)+8;icon(rented and 'poke-ball' or 'ball-muted',x+space/2-ball/2,n==3 and 111 or 124.5,ball,ball);ui:rect(x+space/2-label/2,212.5,label,size*4/3+4,'#e2f1e9');ui:text(m.name,x,214.5,size,'#273d49',space,'center',1)
  if focusIndex==i then ui:triangle(x+space/2-15,240.5,30,13,'#f32022');ui:rect(x+space/2-15,253.5,30,8,'#f32022') end
  if rented then ui:rect(x+space-29,125,19,20,'#ffffe5');ui:text(tostring(i+1),x+space-25,127,14,'#e91e28') end
  hit(m.name,action,i,x,114,space,160,false,action~='candidate')
 end
 if preview then ui:rect(278,99,164,180,'#deffda66');showSprite(ms[focusIndex].num,'front',273,95,174,174) end
end
local function rentalMenu(rows)
 ui:rect(521,306,199,150,'#474954');ui:rect(525,306,195,150,'#383946');ui:rect(530,311,190,140,'#030406')
 local h=#rows==4 and 33 or 42;local top=311+(140-#rows*h)/2
 for i,row in ipairs(rows) do local y=top+(i-1)*h;if i-1==focus-(state.phase=='swap' and 3 or 0) then ui:rect(530,y,190,h,'#ed000e') end;ui:text(row[1],540,y+5,#rows==4 and 21 or 23,row[4] and '#888888' or '#ffffff',175,nil,1);hit(row[1],row[2],row[3],530,y,190,h,row[4],true) end
end
local function rental()
 ui:rect(0,0,720,480,'#5b5b66');local m=state.candidates[rentalFocus];terminalHead(F.get(state,'divisionInfo').name..'租借',m.name,string.format('Lv.50　%02d / 06',rentalFocus+1))
 local chosen={};for _,v in F.iter(state.selected) do chosen[#chosen+1]=v end;rentalStage(state.candidates,rentalFocus,'candidate',chosen,true)
 talk(state.selected._n==3 and '三只宝可梦已选好。\n确认队伍，准备出战！' or '请选择第 '..(state.selected._n+1)..' 只\n租借宝可梦。')
 for i=0,2 do local n=state.selected[i];local x=10+i*163;ui:rect(x,405,158,38,'#464752');if n~=nil then local mon=state.candidates[n];showSprite(mon.num,'icon',x+21,410,28,28);ui:text((i+1)..' '..mon.name..' ×',x+4,416,12,'#f1eac9',150,'center',1);hit('取消租借','unpick',n,x,405,158,38,false,false) else ui:text((i+1)..'　等待租借',x+4,416,12,'#f1eac9',150,'center',1) end end
 rentalMenu({{'查看资料','rental-info'},{selected(rentalFocus) and '取消租借' or '租借这只','toggle',nil,not selected(rentalFocus) and state.selected._n==3},{state.selected._n==3 and '确认队伍' or '换一只看看',state.selected._n==3 and 'lock' or 'rental-next'}})
 foot(inputMode=='touch' and '点击精灵球切换候选　点击菜单选择　B 返回' or inputMode=='controller' and '◀ ▶ 切换候选　▲ ▼ 选择　A 确认　B 返回' or '◀ ▶ 切换候选　▲ ▼ 选择　Z 确认　X 返回')
end
local function striped(y,h,c1,c2)for yy=y,y+h-1,6 do ui:rect(0,yy,720,3,c1);ui:rect(0,yy+3,720,math.min(3,y+h-yy-3),c2) end end
local function intel()
 title(F.get(state,'divisionInfo').name..'　/　第 '..(state.wins+1)..' 战');striped(40,322,'#158b7a','#168574');ui:text('下一位对手的情报',24,57,23,'#ffffe4')
 for i,m in F.iter(state.opponents[state.wins]) do local x=33+i*224;showSprite(m.num,'front',x+25,92,140,130);ui:text(m.name,x,230,21,'#ffffe4',190,'center',1);types(m,x+95,261,true,'#ffffe7') end
 ui:rect(24,292,672,56,'#4b7d70');ui:rect(28,296,664,48,'#e8f0d9');ui:text('招式、特性与道具需要在对战中观察。',38,309,18,'#345a52',644,nil,1)
 ui:rect(0,362,720,118,'#464350');dialogue('全队已经恢复。\n首发是'..state.team[0].name..'，准备出战！',5,367,411,108);ui:panel(421,367,294,108,paper);textButton('开始对战','begin',nil,432,378,272,43,focus%2==0);textButton('查看队伍','team',nil,432,421,272,43,focus%2==1)
end
local function visual(s)return queue and display[s] or call(state.battle,'mon',s) end
local function hp(mon,x,y,own,side)
 local extra=mon.status and mon.status~='' and not own and 22 or 0;local h=own and 109 or 78+extra
 ui:rect(x+5,y+5,280,h,'#687e70');ui:rect(x,y,280,h,'#42573f');ui:rect(x+4,y+4,272,h-8,'#d6d9ad');ui:rect(x+6,y+6,268,h-12,'#ffffe3')
 ui:text(mon.name,x+16,y+14,23,'#3d423a',183,nil,1);ui:text('Lv.50',x+201,y+18,18,'#3d423a',63,nil,1);ui:text('HP',x+16,y+48,14,'#db8a58')
 ui:rect(x+40,y+49,224,12,'#6b7e67');ui:rect(x+42,y+51,220,8,'#414d46');local w=math.max(.01,218*math.max(0,mon.hp/mon.maxhp));hpSlots[side]={};ui:rect(x+43,y+52,w,6,mon.hp>mon.maxhp/2 and '#58bc78' or mon.hp>mon.maxhp/5 and '#e2c54a' or '#d75d47');hpSlots[side][1]=ui.rects[ui.used];ui:rect(x+43,y+52,w,2,'#c2f7b2');hpSlots[side][2]=ui.rects[ui.used]
 if own then ui:text(mon.hp..' / '..mon.maxhp,x+103,y+71,23,'#3d423a',161,'right',1) end
 if mon.status and mon.status~='' then local sy=y+h-25;ui:rect(x+10,sy,68,20,statusColor[mon.status] or '#6c7889');ui:text(E.statusZh[mon.status] or mon.status,x+15,sy+2,14,'#ffffff',60,nil,1) end
 for i,m in F.iter(state.battle.sides[side].team) do local alive=mon.alive and mon.alive[i] or not mon.alive and m.hp>0;icon(alive and 'poke-ball' or 'ball-muted',x+215+i*22,y+h,20,20) end
end
local function field()
 local b=state.battle;local env=shown and shown.environment or b
 striped(0,342,'#fcfcf8','#edf1f0');ui:ellipse(405,151,310,64,'#d5d7b8');ui:ellipse(411,157,298,52,'#c6c8a7');ui:ellipse(0,278,330,64,'#d5d7b8');ui:ellipse(6,284,318,52,'#c6c8a7')
 -- Prewarm the six current battlers' facing-specific atlases. The transparent
 -- one-pixel references keep bench assets ready without visible placeholders.
 if PREVIEW.enabled then for side=0,1 do for _,m in F.iter(b.sides[side].team) do local a=art(m.num,side==0 and 'back' or 'front');ui:texture(a.ids[1],0,20,1,1,'#ffffff00') end end end
 if PREVIEW.enabled and queue then V.prewarm(ui,queue,queueIndex-1) end
 local a,z=visual(0),visual(1);local function visible(m,s)return m.present~=false and (m.hp>0 or queue and shown and shown.side==s and (shown.kind=='damage' or shown.kind=='faint')) and (not m.underground or queue and shown and shown.side==s and shown.kind=='charge') end
 if visible(z,1) then showSprite(z.num,'front',455,19,228,196,true,1) end;if visible(a,0) then showSprite(a.num,'back',25,99,280,235,true,0) end
 hp(z,28,40,false,1);hp(a,415,208,true,0)
 ui:rect(0,0,720,19,'#e9efec');ui:text(F.get(state,'divisionInfo').name..' '..math.min(7,state.wins+1)..' / 7',9,2,11,'#5e7068');ui:text('第 '..(queue and shown and shown.turn or b.turn)..' 回合',600,2,11,'#5e7068',111,'right',1)
 if env.weather and env.weather~='' then local left=env.left or env.weatherLeft or b.weatherLeft;ui:rect(451,21,255,18,'#eef4dfdd');ui:text((weatherZh[env.weather] or env.weather)..(left<0 and ' · 持续' or ' · 剩余 '..left..' 回合'),458,22,11,'#43595d',242,'right',1) end
 if env.terrain and env.terrain~='' then ui:rect(499,41,207,18,'#e9e4b9dd');ui:text('电气场地 · 剩余 '..env.terrainLeft..' 回合',505,42,11,'#43595d',194,'right',1) end
end
local function battle()
 field();local b=state.battle;local own=call(b,'mon',0);ui:rect(0,342,720,118,'#484451')
 if queue then dialogue(message,5,350,710,105)
 elseif menu=='moves' and b.phase~='forced' then
  ui:panel(5,350,438,105,'#fffff7','#77758b');ui:panel(449,350,266,105,'#fffff7','#77758b')
  local choices=call(b,'choices',0);local usable={};for _,s in F.iter(choices) do usable[s.index]=true end
  for i,s in F.iter(own.moves) do local x=13+(i%2)*211;local y=358+math.floor(i/2)*44;textButton(D.moveNames[s.id],'move',i,x,y,211,44,i==focus%4,not usable[i],22) end
  if choices._n==0 then button('挣扎','move',-1,17,364,412,78) end
  local s=choices._n==0 and {id='struggle',pp=0,maxpp=0} or own.moves[focus%4];local m=M.moves[s.id]
  ui:text('PP',463,358,23,ink);ui:text(choices._n==0 and '—' or s.pp..' / '..s.maxpp,545,358,23,ink,151,'right',1);ui:text('属性',463,390,15,ink);badge(m.type,503,392);badge(m.category,463,422)
  ui:panel(666,410,36,36,'#fffde8');for _,r in ipairs({{3,1,6,2},{1,3,2,3},{9,3,2,4},{7,7,2,2},{5,9,2,2},{5,12,2,2}}) do ui:rect(675+r[1]*1.5,416+r[2]*1.5,r[3]*1.5,r[4]*1.5,'#43414b') end;hit('查看招式说明','move-info',choices._n==0 and -1 or focus%4,663,407,42,42,false,false)
 else
  dialogue(b.phase=='forced' and '请选择下一只宝可梦。' or message~='' and message or own.name..'，\n接下来怎么做？',5,350,391,105);ui:panel(401,350,314,105,paper)
  local rows={{'战斗','moves'},{'宝可梦','team'},{'对战状态','field-info'},{'战斗记录','history'}}
  for i,row in ipairs(rows) do local x=412+(i-1)%2*146;local y=359+math.floor((i-1)/2)*43;textButton(row[1],row[2],nil,x,y,146,43,i-1==focus%4,row[2]=='moves' and b.phase=='forced',24) end
 end
 ui:rect(0,460,720,20,'#e5e9e3');if menu=='moves' and not queue and inputMode~='touch' then ui:text('◀ 返回',8,462,12,'#50675d');hit('返回','back',nil,8,457,90,23,false,false) end
 ui:text(inputMode=='controller' and 'X 说明　Y 菜单' or inputMode=='touch' and '点击招式使用　? 查看说明' or 'Y 说明　Tab 菜单',268,462,12,'#50675d',440,'right',1)
end
local function modal(titleText,confirmation)
 ui:rect(-offsetX/viewScale,-offsetY/viewScale,canvasW/viewScale,canvasH/viewScale,'#111820a8');ui:panel(0,8,720,464,'#edf0d9','#747188');ui:rect(5,13,710,38,'#83509a');ui:text(titleText,17,21,16,'#ffffff',680,nil,1)
 ui:rect(5,427,710,40,'#d5dbcc');ui:rect(5,427,710,3,'#7a7e85');if not confirmation and not forcedTeam() then button('返回','back',nil,610,431,94,34) end
end
local function drawHistory()
 if not history then return end
 history:draw(historyUI);historyBar:begin()
 local h=history.maximum>0 and math.max(24,H.height*H.height/(history.maximum+H.height)) or H.height
 local y=history.maximum>0 and history.offset/history.maximum*(H.height-h) or 0
 historyBar:rect(672,66,8,H.height,'#c3cbb9');historyBar:rect(672,66+y,8,h,'#788a79');historyBar:finish()
end
scrollHistory=function(delta,absolute)
 if overlay and overlay.kind=='history' and history and history:scroll(delta,absolute) then drawHistory() end
end
local function historyPanel()
 modal('战斗记录')
 if not history then history=H.new(call(state,'records'),F.iter,G) end
 G.box(historyViewport,22,66,H.width,H.height);drawHistory()
 hit('滚动战斗记录','history-scroll',nil,22,66,H.width,H.height,false,false)
 hit('记录滚动条','history-bar',nil,665,66,29,H.height,false,false)
 ui:text('上下滑动或使用方向键查看完整记录',22,438,12,ink,560,nil,1)
end
local function summary(m)
 modal(overlay.hidden and '对手观测记录' or '宝可梦资料');ui:rect(5,51,710,376,'#0d7d70')
 local tabs={'基本资料','能力与道具','招式'};for i,t in ipairs(tabs) do local x=5+(i-1)*710/3;ui:rect(x,51,710/3,38,i-1==detailPage and '#ab56c2' or '#d69be0');ui:rect(x,85,710/3,4,i-1==detailPage and '#fff3a3' or '#e8cfeb');ui:text(t,x,61,16,i-1==detailPage and '#ffffff' or '#67376d',710/3,'center',1);hit(t,'summary-page',i-1,x,51,710/3,38,false,true) end
 ui:rect(15,99,210,318,'#73b78b');ui:rect(20,104,200,308,'#a1d6a6');ui:text(string.format('No.%03d',m.num),28,112,23,'#ffffe9');for yy=150,332,6 do ui:rect(35,yy,170,3,'#c2d6bd');ui:rect(35,yy+3,170,3,'#e2e8d4') end;showSprite(m.num,'front',35,150,170,185);ui:text('Lv.50 '..m.name,24,347,20,'#ffffe9',192,'center',1);types(m,120,384,true,'#ffffe9')
 local color=detailPage==0 and '#c5ddb1' or detailPage==1 and '#8571c3' or '#5c2db6';ui:rect(235,99,470,318,detailPage==0 and '#446c59' or '#645183');ui:rect(239,103,462,310,color)
 local hidden=overlay.hidden
 local function block(label,name,desc,y,h)
  ui:rect(248,y,444,h,'#f7ffe9');ui:rect(254,y+3,432,23,detailPage==1 and '#c9c447' or '#4a8aba');ui:text(label,261,y+5,15,'#ffffff',417,nil,1);ui:text(name,256,y+28,20,ink,428,nil,1)
  -- Long descriptions open a readable detail panel; never squeeze Chinese
  -- down to 10px merely to fit a fixed-height card.
  local size=16;local maxLines=math.max(1,math.floor((h-55)/(size*4/3)));local lines=G.lines(desc,size,428)
  if #lines>maxLines then
   lines=G.lines(desc,size,384);local preview={};for i=1,maxLines do preview[i]=lines[i] end
   preview[maxLines]=(G.lines(preview[maxLines],size,368)[1] or '')..'…';ui:text(table.concat(preview,'\n'),256,y+55,size,ink,384,nil,maxLines)
   overlay.traits=overlay.traits or {};overlay.traits[label]={label=label,name=name,text=desc};button('?','trait-info',label,654,y+h-33,32,28)
  else ui:text(desc,256,y+55,size,ink,428,nil,maxLines) end
 end
 if detailPage==0 then
  block('属性','','',112,66);types(m,259,154,false,ink)
  local revealed=not hidden or m.revealedAbility;block('特性',revealed and m.abilityZh or '未确认',revealed and I.abilities[id(m.ability)] or '尚未观察到特性发动。',186,113)
  local nat=I.natures[m.nature];local desc=nat and nat._n>0 and (I.stats[nat[0]]..'提高 10%，'..I.stats[nat[1]]..'降低 10%；其余能力不变。修正已计入下方能力值。') or '中性性格，所有能力值均不增减。';block('训练家笔记',hidden and '性格未公开' or m.natureZh,hidden and '对手隐藏资料不提前公开。' or desc,307,98)
 elseif detailPage==1 then
  local revealed=not hidden or m.revealedItem;block('携带道具',revealed and m.itemZh or '未确认',revealed and I.items[id(m.item)] or '尚未观察到道具效果。',112,118)
  ui:rect(248,238,444,130,'#f7ffe9');if hidden then ui:text('对手能力值未公开。',260,261,18,ink,414) else
   local nat=I.natures[m.nature];for j,k in ipairs({'hp','atk','def','spa','spd','spe'}) do local x=260+(j-1)%2*214;local y=247+math.floor((j-1)/2)*39;local up=nat and nat[0]==k;local down=nat and nat[1]==k;local c=up and '#b94d32' or down and '#496fba' or ink;ui:text(I.stats[k]..(up and '↑' or down and '↓' or ''),x,y,19,c);ui:text(m.stats[k],x+107,y,22,c,88,'right',1) end;ui:text('已计入性格，不含临时能力变化。',248,382,12,'#fffadd',444) end
 else
  local moves=hidden and m.seen or m.moves
  for i,s in F.iter(moves) do local sid=hidden and s or s.id;local y=112+i*45;local meta=M.moves[sid];ui:rect(248,y,444,43,i==summaryMove and '#eb654f' or '#b8c2ad');ui:rect(250,y+2,440,39,i==summaryMove and '#fff5cd' or '#f6ffe9');badge(meta.type,257,y+13,false);ui:text(D.moveNames[sid],314,y+9,17,ink,238,nil,1);ui:text(hidden and '已观察' or 'PP '..s.pp..'/'..s.maxpp,581,y+14,12,ink,100,'right',1);hit('查看招式','summary-move',i,248,y,444,43,false,true) end
  local s=moves[summaryMove] or moves[0];if s then local sid=hidden and s or s.id;local meta=M.moves[sid];ui:rect(248,297,444,108,'#fffde8');ui:rect(253,301,434,22,'#bc4cbc');ui:text('招式说明',260,303,15,'#ffffff');badge(meta.category,256,327);ui:text('威力 '..(meta.power>0 and meta.power or '—')..'  命中 '..(meta.accuracy==true and '必中' or meta.accuracy..'%'),350,327,13,ink,330,nil,1);ui:text(I.moves[sid],256,348,14,ink,428,nil,3) else ui:text('尚未观察到招式。',258,130,18,ink) end
 end
 ui:text(detailPage==2 and '◀ ▶ 换页　▲ ▼ 招式　X / B 返回' or '◀ ▶ 切换资料页',24,440,12,ink)
end
local function teamList()
 local inBattle=state.phase=='battle';local ms=inBattle and state.battle.sides[0].team or state.team;modal(inBattle and '选择出战宝可梦' or '我的挑战队伍');ui:rect(5,51,710,376,'#6e9c79')
 local allowed={};if inBattle then for _,i in F.iter(call(state.battle,'switchable',0)) do allowed[i]=true end end
 for i,m in F.iter(ms) do local y=66+i*96;local active=inBattle and i==state.battle.sides[0].active;ui:rect(17,y,686,84,active and '#e27543' or '#44646c');ui:rect(21,y+4,678,76,active and '#fff7cf' or '#eff9da');showSprite(m.num,'icon',30,y+15,64,50);ui:text(m.name,111,y+10,19,'#384e50',260,nil,1);ui:text('Lv.50',374,y+14,12,'#384e50');ui:rect(111,y+40,390,12,'#414d46');ui:rect(113,y+42,386*m.hp/m.maxhp,8,'#58bc78');ui:text(m.hp..' / '..m.maxhp,111,y+58,14,'#384e50');if m.status~='' then ui:rect(277,y+56,68,22,statusColor[m.status] or '#6c7889');ui:text(E.statusZh[m.status] or m.status,282,y+59,13,'#ffffff') end
  if inBattle then button(active and '出战中' or m.hp<=0 and '已倒下' or '换上','switch',i,516,y+24,91,38,not allowed[i] or not call(state.battle,'canSwitch',0) and state.battle.phase~='forced') end;button('资料','mon-info',i,615,y+24,72,38)
 end
 ui:rect(17,364,686,48,'#5a6a71');ui:rect(21,368,678,40,'#fffbea');ui:text(inBattle and '选择要出战的宝可梦。' or '查看伙伴的能力与配招。',30,378,18,ink,658,nil,1)
end
local function moveDetail(s)
 modal('招式详情');local m=M.moves[s.id];ui:text(D.moveNames[s.id],24,73,25,ink);badge(m.type,25,115);badge(m.category,136,115)
 local metrics={{'威力',m.power>0 and m.power or '—'},{'命中',m.accuracy==true and '必中' or tostring(m.accuracy)..'%'},{'PP',s.id=='struggle' and '无限' or s.pp..'/'..s.maxpp},{'优先度',m.priority}}
 for j,c in ipairs(metrics) do local x=24+(j-1)*169;ui:rect(x,155,164,80,'#d8e4c9');ui:text(c[1],x+8,169,13,ink,148,'center',1);ui:text(c[2],x+8,195,21,ink,148,'center',1) end
 ui:rect(24,251,671,116,'#889d88');ui:rect(27,254,665,110,'#faffea');ui:text(I.moves[s.id],40,271,17,ink,638,nil,3);ui:text('查看详情不会使用招式，也不消耗回合。',24,384,13,ink,670,nil,1)
end
local function publicEffects(side)
 local mon=call(state.battle,'mon',side);local rows={};local v=mon.vol
 local function add(name,time,desc)rows[#rows+1]={name,time,desc} end
 local statusText={psn='每回合末受到中毒伤害。',tox='每回合末受到逐渐增加的剧毒伤害。',brn='回合末受到伤害，并影响物理攻击。',par='速度下降，行动时可能无法动弹。',slp='暂时无法行动，不公开随机睡眠倒计时。',frz='暂时无法行动，可能解冻。'}
 if mon.status~='' then add(E.statusZh[mon.status],(mon.status=='slp' or mon.status=='frz') and '解除时机不确定' or '持续至治愈',statusText[mon.status]) end
 for _,row in ipairs({{'reflect','反射壁','减轻受到的物理伤害。'},{'lightscreen','光墙','减轻受到的特殊伤害。'},{'safeguard','神秘守护','防止对手招式施加异常与混乱，不解除已有状态。'},{'mist','白雾','防止对手降低能力等级。'},{'tailwind','顺风','本方速度提高。'},{'stealthrock','隐形岩','换入时受到岩石属性伤害。'}}) do local n=state.battle.sides[side].conditions[row[1]];if n and n~=0 then add(row[2],n<0 and '持续至清除' or '剩余 '..n..' 回合',row[3]) end end
 if v.paradox then add(mon.abilityZh,'环境结束或换下解除',I.stats[v.paradox.stat]..' ×'..(v.paradox.stat=='spe' and '1.5' or '1.3')..'；不占用能力等级。') end
 if v.choiceLock and mon.itemActive and (side==0 or mon.revealedItem) then add('讲究锁定','换下或失去道具后解除',D.moveNames[v.choiceLock]..'；其他招式暂时无法选择。') end
 if v.confusion then add('混乱','剩余回合未知','行动时可能攻击自己；换下后解除。') end
 if v.seed~=nil then add('寄生种子','持续至换下','回合末吸取 HP，回复对方。') end
 if v.wrap then add('紧束','剩余回合未知','回合末受到伤害，暂时不能主动换人。') end
 for _,k in ipairs({'disable','encore'}) do if v[k] then add(k=='disable' and '定身法' or '再来一次','剩余回合未知',D.moveNames[v[k].id]..(k=='disable' and '暂时无法使用。' or '被锁定为使用招式。')) end end
 if v.yawn then add('瞌睡','剩余 '..v.yawn..' 次回合末','届时可能陷入睡眠；换下后解除。') end
 if v.dig then add('挖洞蓄力','下次行动','处于地下，下一次行动继续挖洞。') end
 for _,r in ipairs({{'watersport','玩水','场上火属性招式威力降低。'},{'mudsport','玩泥','场上电属性招式威力降低。'},{'foresight','识破','受到识破相关命中与属性效果影响。'},{'minimize','变小','踩踏会造成更高伤害。'},{'flashfire','引火强化','火属性招式威力提高。'},{'grudge','怨念','被直接击倒时，可能令该招式 PP 归零。'}}) do if v[r[1]] then add(r[2],r[1]=='grudge' and '至下次行动' or '持续至换下',r[3]) end end
 return rows
end
local function fieldDetail()
 local b=state.battle;local rows={publicEffects(0),publicEffects(1)};fieldPages=1+math.max(1,math.ceil(math.max(#rows[1],#rows[2])/4));modal('对战状态');ui:text('第 '..b.turn..' 回合 · 查看不消耗行动。随机持续效果不公开内部倒计时。',22,62,12,ink,675,nil,1)
 ui:rect(20,86,680,84,'#849789');ui:rect(23,89,674,78,'#fbffe7');ui:text('天气与全场效果',33,96,17,ink)
 local txt=b.weather~='' and (weatherZh[b.weather]..(b.weatherLeft<0 and ' · 持续至天气替换或战斗结束' or ' · 剩余 '..b.weatherLeft..' 回合')) or '正常天气 · 无倒计时';ui:text(txt,33,122,14,ink,650,nil,1);ui:text(b.terrain~='' and '电气场地 · 剩余 '..b.terrainLeft..' 回合' or '当前没有特殊场地。',33,145,12,ink,650,nil,1)
 for side=0,1 do local x=20+side*344;local mon=call(b,'mon',side);ui:rect(x,181,336,230,'#849789');ui:rect(x+3,184,330,224,'#fbffe7');ui:text((side==0 and '我方 · ' or '对方 · ')..mon.name,x+12,192,17,ink,312,nil,1)
  if detailPage==0 then ui:text('能力等级',x+12,223,14,ink);for j,k in ipairs({'atk','def','spa','spd','spe','accuracy','evasion'}) do local v=mon.boosts[k];local bx=x+12+(j-1)%4*79;local by=247+math.floor((j-1)/4)*70;local c=v>0 and '#a43f2a' or v<0 and '#365c97' or ink;ui:rect(bx,by,74,64,v>0 and '#f7dec5' or v<0 and '#d4e3f6' or '#e1e8d3');ui:text(I.stats[k],bx,by+5,12,c,74,'center',1);ui:text((v>0 and '+' or '')..v,bx,by+24,20,c,74,'center',1) end;ui:text('仅显示能力等级修正。',x+12,390,12,ink,310,nil,1)
  else
   local first=(detailPage-1)*4+1;local effects=rows[side+1]
   for j=0,3 do local row=effects[first+j];if row then local y=223+j*45;ui:text(row[1],x+12,y,13,ink,140,nil,1);ui:text(row[2],x+147,y+1,10,ink,176,'right',1);ui:text(row[3],x+12,y+18,11,ink,310,nil,2) end end
   if not effects[first] then ui:text(#effects==0 and '没有持续中的特殊效果。' or '本方没有更多效果。',x+12,226,13,ink,310) end
  end
 end
 button(detailPage==0 and '场地与特殊效果' or detailPage<fieldPages-1 and '更多特殊效果' or '能力等级','field-page',nil,390,434,207,29);ui:text((detailPage+1)..' / '..fieldPages,22,441,12,ink)
end
local function swap()
 local own=swapOwn<0;local ms=own and state.team or state.lastEnemy;local chosen=own and -1 or swapFoe
 ui:rect(0,0,720,480,'#5b5b66');terminalHead('宝可梦交换',own and '选择换出的伙伴' or '选择加入的伙伴','本轮 '..state.wins..' 胜 / 7');rentalStage(ms,focus<3 and focus or chosen,own and 'swap-own' or 'swap-foe',chosen<0 and {} or {chosen},false)
 talk(own and '从我方队伍中\n选择要换出的宝可梦。' or '换出：'..state.team[swapOwn].name..'\n'..(swapFoe<0 and '请选择对方的一只宝可梦。' or '加入：'..state.lastEnemy[swapFoe].name))
 ui:text('HP、PP、异常状态和道具已恢复。\n对手的招式、特性与道具以观察结果为准。',14,408,12,'#e6e1d3',480,nil,2)
 if own then rentalMenu({{'查看资料','swap-info'},{'保持队伍','skip-swap'}}) else rentalMenu({{'查看资料','swap-info'},{'确认交换','exchange',nil,swapFoe<0},{'重新选择','swap-reset'},{'保持队伍','skip-swap'}}) end
 foot(F.get(state,'divisionInfo').name..' · 交换伙伴或保持队伍，继续下一场挑战。')
end
local function result()
 title(F.get(state,'divisionInfo').name..'　/　挑战记录');striped(40,322,'#0d8777','#148f7b');ui:text(state.phase=='win' and '★ ★ ★' or 'CHALLENGE',0,53,18,'#ffe96a',720,'center',1);ui:text(state.phase=='win' and '七连胜！' or '挑战结束',0,82,32,'#fff8d1',720,'center',1)
 for i,m in F.iter(state.team) do local x=130+i*165;showSprite(m.num,'front',x,134,130,130);ui:text(m.name,x,272,18,'#fff8d1',130,'center',1) end
 ui:text('胜场 '..state.wins..' / 7　　交换 '..state.swaps..' 次　　行动 '..state.totalTurns..' 回合',18,320,18,'#fff8d1',684,'center',1);ui:rect(0,362,720,118,'#464350');dialogue(state.phase=='win' and '恭喜完成本轮挑战！' or '研究员期待你的下一次挑战。',5,367,411,108);ui:panel(421,367,294,108,paper);textButton('选择级别','restart',nil,432,378,272,43,focus%2==0);textButton('查看记录','history',nil,432,421,272,43,focus%2==1)
end
local function chrome()
 local rail=96/viewScale;local top=34/viewScale
 ui:rect(-offsetX/viewScale,-(canvasH-offsetY)/viewScale+480,canvasW/viewScale,canvasH/viewScale,'#171a20');ui:rect(-rail-2,-top-2,720+rail*2+4,480+top+4,'#3c424e');ui:rect(-rail,-top,720+rail*2,480+top,'#292d36')
 ui:text('对战工厂',0,-top+3,14,'#edf2e8');local topRows={{inputMode=='controller' and 'Y 菜单' or inputMode=='touch' and '菜单' or 'Tab 菜单','options',614,102},{'结算','game-over',720,96}}
 for _,row in ipairs(topRows) do local x,w=row[3],row[4];ui:text(row[1],x,-top+3,14,'#edf2e8');hit(row[1],row[2],nil,x,-top,w,top,queue~=nil or (row[2]=='game-over' and gameOverSent),false) end
end
local function pads()
 if inputMode~='touch' or overlay then return end
 local unit=1/viewScale;local x=-93*unit;local y=240-66*unit
 local keys={{'▲','up',x+22*unit,y},{'◀','left',x,y+44*unit},{'▶','right',x+44*unit,y+44*unit},{'▼','down',x+22*unit,y+88*unit}}
 for _,k in ipairs(keys) do ui:rect(k[3],k[4],44*unit,44*unit,'#8c9e9c');ui:rect(k[3]+2*unit,k[4]+2*unit,40*unit,40*unit,'#3c4a56');ui:text(k[1],k[3],k[4]+10*unit,18*unit,'#f7f3d7',44*unit,'center',1);hit(k[2],'direction',k[2],k[3],k[4],44*unit,44*unit,queue~=nil,false) end
 for i,row in ipairs({{'A','confirm','确认'},{'B','back','返回'}}) do if i==1 or state.phase~='division' and not (state.phase=='battle' and menu=='root') then local xx=720+26*unit;local yy=240+(i==1 and -65 or 7)*unit;ui:ellipse(xx,yy,58*unit,58*unit,'#8c9e9c');ui:ellipse(xx+3*unit,yy+3*unit,52*unit,52*unit,i==1 and '#786b4a' or '#3c4a56');ui:text(row[1],xx,yy+11*unit,18*unit,'#f7f3d7',58*unit,'center',1);ui:text(row[3],xx,yy+36*unit,10*unit,'#f7f3d7',58*unit,'center',1);hit(row[1],row[2],nil,xx,yy,58*unit,58*unit,queue~=nil,false) end end
end
local modalPages,modalPageClock={},0
local function selectModalPage()
 local key=overlay.kind..(overlay.kind=='mon' and '-'..detailPage or overlay.kind=='field' and '-'..detailPage or '')
 modalPageClock=modalPageClock+1
 local page=modalPages[key]
 if not page then
  local count,oldest,oldestKey=0,nil,nil
  for k,p in pairs(modalPages) do count=count+1;if not oldest or p.last<oldest.last then oldest=p;oldestKey=k end end
  -- Four pages retain all three summary tabs plus the menu. Bound dormant UI
  -- memory when visiting history, traits, and other uncommon panels.
  if count>=4 then game.DestroyClientUIControl(oldest.ui.parent);modalPages[oldestKey]=nil end
  local parent=container('ModalPage-'..key,modalStage)
  page={ui=G.new(parent,'modal-'..key)};page.ui.retain=true;modalPages[key]=page
 end
 for _,p in pairs(modalPages) do local visible=p==page;if p.visible~=visible then p.ui.parent:SetVisible(visible);p.visible=visible end end
 page.last=modalPageClock;modalUI=page.ui
end
draw=function()
 buttons={};sprites={}
 if not overlay then ui:begin();chrome()
 if queue or state.phase=='battle' then battle() elseif state.phase=='division' then division() elseif state.phase=='rental' then rental() elseif state.phase=='intel' then intel() elseif state.phase=='swap' then swap() else result() end
 end
 local mainUI,mainScale,mainX,mainY=ui,viewScale,offsetX,offsetY
 modalStage:SetVisible(overlay~=nil)
 historyViewport:SetVisible(overlay~=nil and overlay.kind=='history');historyBar.parent:SetVisible(overlay~=nil and overlay.kind=='history')
 if overlay then
  -- Keep the existing background intact. Only the modal contributes inputs;
  -- unused hitboxes are disabled at the end of this draw.
  selectModalPage();ui=modalUI;ui:begin()
  if overlay.kind=='team' then teamList() elseif overlay.kind=='mon' then summary(overlay.mon) elseif overlay.kind=='move' then moveDetail(overlay.slot) elseif overlay.kind=='field' then fieldDetail()
  elseif overlay.kind=='trait' then modal(overlay.data.label..'说明');ui:text(overlay.data.name,26,75,26,ink,665);ui:panel(20,133,680,274,'#faffea','#889d88');ui:text(overlay.data.text,37,155,20,ink,645,nil,9)
  elseif overlay.kind=='history' then historyPanel()
  elseif overlay.kind=='options' then modal('游戏菜单');button('玩法说明','rules',nil,40,78,640,48);button(sound and '声音：开' or '声音：关','sound',nil,40,136,640,48);button(motion and '动画：开' or '动画：简','motion',nil,40,194,640,48);button('返回开始','home',nil,40,252,640,48,state.phase=='division');if state.phase=='battle' then button('结束挑战','resign-prompt',nil,40,310,640,48) end;ui:text(hint(),24,389,12,ink,675,nil,1)
  elseif overlay.kind=='rules' then modal('对战工厂 · 玩法说明');ui:text('租借伙伴，挑战七连胜。\n\n① 从六只候选中租借三只宝可梦。\n② 每场 3 对 3 单打，全员 50 级。\n③ 点击招式即可使用；查看说明不消耗回合。\n④ 战胜对手后，全队恢复 HP、PP、状态和道具。\n⑤ 可交换一只伙伴，也可保持队伍。\n⑥ 连赢七场完成挑战，任一场失败则结束。\n\n同一种宝可梦也可能有不同招式、特性和道具。',24,65,17,ink,670)
  else modal(overlay.kind=='home' and '返回开始页面' or '结束本轮挑战',true);ui:text(overlay.kind=='home' and '结束本轮挑战并返回开始？' or '结束后将记录当前 '..state.wins..' 场胜利。\n本轮无法继续。',28,117,23,ink,660);button('取消','back',nil,455,431,112,34);button(overlay.kind=='home' and '返回开始' or '确认结束',overlay.kind=='home' and 'restart' or 'resign',nil,580,431,124,34) end
 end
 local nav=N.list(buttons)
 if overlay and overlay.kind=='mon' and detailPage==2 then
  -- Focus and the rendered description must agree after keys, clicks, and
  -- switching tabs. An empty observation list keeps the Back button focused.
  focus=0
  for i,b in ipairs(nav) do if b.key=='summary-move' and b.index==summaryMove then focus=i-1;break end end
 end
 local normalized=N.normalize(nav,focus)
 if normalized~=focus then
  focus=normalized
  -- A forced replacement starts on the disabled fainted slot. Redrawing its
  -- new focus must leave the modal drawing context first; otherwise the next
  -- battle frame is painted into the modal after that layer has been hidden.
  if overlay then ui:finish() end
  ui=mainUI;viewScale=mainScale;G.scale=mainScale;offsetX=mainX;offsetY=mainY
  return draw()
 end
 local selectedButton=nav[focus+1]
 if selectedButton and not queue and (overlay or state.phase~='swap') then local b=selectedButton;local c='#e4ad35';for _,r in ipairs({{b.x,b.y,b.w,2},{b.x,b.y+b.h-2,b.w,2},{b.x,b.y,2,b.h},{b.x+b.w-2,b.y,2,b.h}}) do ui:rect(r[1],r[2],r[3],r[4],c) end end
 if overlay then ui:finish();if overlay.kind=='history' then historyViewport:SetAsLastSibling();historyBar.parent:SetAsLastSibling() end end;ui=mainUI;viewScale=mainScale;G.scale=mainScale;offsetX=mainX;offsetY=mainY
 pads();for i=#buttons+1,#hitboxes do hitboxes[i].c.name='inactive-input-'..i;hitboxes[i].c:SetVisible(false);hitboxes[i].c.raycastTarget=false end;ui:finish();if queue then updateSprites() end
end
local function openMon(m,parent,hidden)if parent then parent.focus=focus;parent.page=detailPage end;overlay={kind='mon',mon=m,parent=parent,hidden=hidden,returnFocus=focus};detailPage=0;summaryMove=0;focus=0 end
local function play(events,before)
 if queue or events==lastPlayback then return end
 local opening=events[0] and events[0].kind=='battle_start'
 if opening and introBattle==state.battle then return end
 lastPlayback=events;if opening then introBattle=state.battle end
 queue=events;queueIndex=0;eventClock=0;shown=nil;display=before or events[0] and F.clone(events[0].visual) or {}
 if opening then for side=0,1 do display[side].present=false end end
 headline='';overlay=nil;menu='root';startEvent()
end
local function finishPlayback()queue=nil;shown=nil;menu='root';focus=0;if state.phase=='battle' and state.battle.phase=='forced' then overlay={kind='team'} end;draw() end
local function act(a)
 if queue then return end;local before={[0]=F.clone(call(state.battle,'mon',0)),[1]=F.clone(call(state.battle,'mon',1))};local r=call(state,'act',F.obj(a));if not r.ok then print('factory-rejected',r.error);return end;play(r.events,before)
end
back=function()
 if queue then return end
 if overlay then if forcedTeam() then return end;local old=overlay;overlay=overlay.parent;focus=overlay and overlay.focus or old.returnFocus or 0;detailPage=overlay and overlay.page or detailPage
 else focus=0;if state.phase=='battle' then menu='root' elseif state.phase=='rental' or state.phase=='intel' then overlay={kind='home'} elseif state.phase=='swap' then if swapOwn>=0 then swapOwn=-1;swapFoe=-1 else overlay={kind='home'} end elseif state.phase=='win' or state.phase=='loss' then state=newChallenge() end end
 draw()
end
confirm=function()
 if queue then return end
 local b=N.list(buttons)[focus+1];if b and not b.disabled then dispatch(b.key,b.index) end
end
dispatch=function(key,index)
 if key=='back' then return back() end;if key=='confirm' then return confirm() end;if queue then return end
 if key=='details' then
  if not overlay and state.phase=='battle' and menu=='moves' then local b=N.list(buttons)[focus+1];if b and b.key=='move' then return dispatch('move-info',b.index) end
  elseif not overlay and state.phase=='rental' then return dispatch('rental-info')
  elseif not overlay and state.phase=='swap' then return dispatch('swap-info')
  elseif overlay and overlay.kind=='team' then local b=N.list(buttons)[focus+1];if b and b.index~=nil then return dispatch('mon-info',b.index) end end;return
 end
 if sound and key~='sound' then game.PlayAudio2D(50888) end
 if key=='game-over' then sendGameOver();return draw() end
 if key=='direction' or key=='nav' then
  local delta=key=='nav' and index or (index=='left' or index=='up') and -1 or 1
  if overlay and overlay.kind=='history' then return scrollHistory(delta*H.lineHeight*3)
  elseif overlay and overlay.kind=='mon' and (index=='left' or index=='right') then detailPage=(detailPage+delta+3)%3;summaryMove=0
  elseif overlay and overlay.kind=='mon' and detailPage==2 then
   local moves=overlay.hidden and overlay.mon.seen or overlay.mon.moves
   if moves._n>0 then summaryMove=(summaryMove+delta+moves._n)%moves._n end
  elseif not overlay and state.phase=='rental' and (index=='left' or index=='right') then rentalFocus=(rentalFocus+delta+6)%6
  else focus=N.next(N.list(buttons),focus,index) end
 elseif key=='division' then call(state,'chooseDivision',index);focus=0;rentalFocus=0
 elseif key=='candidate' then rentalFocus=index
 elseif key=='rental-next' then rentalFocus=(rentalFocus+1)%6
 elseif key=='toggle' then call(state,'select',rentalFocus)
 elseif key=='unpick' then call(state,'select',index)
 elseif key=='rental-info' then openMon(state.candidates[rentalFocus])
 elseif key=='lock' then call(state,'lock');focus=0
 elseif key=='begin' then if call(state,'begin') then return play(state.battle.events) end
 elseif key=='moves' then menu='moves';focus=0
 elseif key=='move' then return act({kind='move',index=index})
 elseif key=='team' then overlay={kind='team'};focus=0
 elseif key=='switch' then overlay=nil;return act({kind='switch',index=index})
 elseif key=='mon-info' then openMon((state.phase=='battle' and state.battle.sides[0].team or state.team)[index],overlay)
 elseif key=='summary-page' then detailPage=index;summaryMove=0
 elseif key=='trait-info' then overlay.focus=focus;overlay.page=detailPage;overlay={kind='trait',data=overlay.traits[index],parent=overlay};focus=0
 elseif key=='page-nav' then detailPage=(detailPage+index+3)%3;summaryMove=0
 elseif key=='summary-move' then summaryMove=index
 elseif key=='move-info' then overlay={kind='move',slot=index<0 and {id='struggle',pp=0,maxpp=0} or call(state.battle,'mon',0).moves[index],returnFocus=focus};focus=0
 elseif key=='field-info' then overlay={kind='field'};detailPage=0;focus=0
 elseif key=='field-page' then detailPage=(detailPage+1)%fieldPages
 elseif key=='swap-own' then swapOwn=index;swapFoe=-1;focus=0
 elseif key=='swap-foe' then swapFoe=index
 elseif key=='swap-reset' then swapOwn=-1;swapFoe=-1;focus=0
 elseif key=='swap-info' then local b=N.list(buttons)[focus+1];local candidate=b and (b.key=='swap-own' or b.key=='swap-foe') and b.index or 0;openMon(swapOwn<0 and state.team[candidate] or state.lastEnemy[swapFoe>=0 and swapFoe or candidate],nil,swapOwn>=0)
 elseif key=='exchange' then if swapOwn>=0 and swapFoe>=0 then if call(state,'exchange',swapOwn,swapFoe) then swapOwn=-1;swapFoe=-1 else print('factory-rejected','交换违反重复物种或道具规则') end end
 elseif key=='skip-swap' then call(state,'exchange');swapOwn=-1;swapFoe=-1;focus=0
 elseif key=='resign-prompt' then overlay={kind='resign',parent=overlay};focus=0
 elseif key=='resign' then call(state,'resign');overlay=nil;focus=0
 elseif key=='restart' then state=newChallenge();overlay=nil;focus=0;rentalFocus=0
 elseif key=='options' then if not overlay then overlay={kind='options',returnFocus=focus};focus=0 elseif overlay.kind=='options' then return back() end
 elseif key=='home' then if state.phase~='division' then overlay={kind='home',parent=overlay};focus=0 end
 elseif key=='rules' then overlay={kind='rules',parent=overlay};focus=0
 elseif key=='motion' then motion=not motion
 elseif key=='sound' then sound=not sound;if sound then game.PlayAudio2D(50888) end
 elseif key=='history' then history=nil;overlay={kind='history'};focus=0
 elseif key=='history-scroll' or key=='history-bar' then return
 end;draw()
end
local fxStamp=-1
local function effects()
 local stamp=math.floor(clock*30);if stamp==fxStamp then return end;fxStamp=stamp;fx:begin();moveFx:begin()
 if state.battle and not overlay and (state.phase=='battle' or queue) and motion then local env=shown and shown.environment or state.battle;local t=clock;local w=env.weather
  if w=='rain' or w=='sandstorm' or w=='hail' then for i=1,22 do fx:rect((i*71+t*(w=='rain' and 130 or 80))%720,(i*47+t*(w=='rain' and 270 or 50))%330,w=='rain' and 2 or 4,w=='rain' and 13 or 4,w=='rain' and '#719ea0aa' or w=='hail' and '#ffffffdd' or '#b49b6e99') end elseif w=='sun' then for i=0,7 do fx:rect(28+i*85+(t*13)%24,19,22,323,'#fce39520') end end
  if env.terrain=='electric' then for i=1,13 do fx:rect((i*53+t*55)%700,320+(i%4)*5,16,3,'#e6cd35') end end
  for side=0,1 do local v=visual(side);local ev=env.sides and env.sides[side];local conditions=ev and (ev.conditions or ev) or state.battle.sides[side].conditions;V.field(fx,conditions,shown and ev or v.vol,side==0 and 185 or 565,side==0 and 286 or 164,t);if v.hp>0 and v.present~=false then local clearing=queue and shown and shown.kind=='cure' and shown.side==side and shown.visual and shown.visual[side].status=='';local alpha=clearing and math.max(0,1-((eventDuration-eventClock)/animationDuration)/.45) or 1;V.status(fx,v.status,side==0 and 185 or 565,side==0 and 286 or 164,t,alpha) end end
  if queue and shown and eventDuration-eventClock<animationDuration then local p=math.max(0,math.min(1,(eventDuration-eventClock)/animationDuration));if shown.kind=='move' then V.move(moveFx,moveEffect or shown,p) else V.event(moveFx,shown,p) end end
 end;fx:finish();moveFx:finish()
end
local function start(scriptContext,fixedReplaySeed)
 -- An explicit seed is for test/replay callers only; the shipped entry omits it.
 replaySeed=fixedReplaySeed
 gameOverSignal=nil;gameOverSent=false
 hostScript=scriptContext;hostScript:EnableUpdate(true);hostScript.object.showCursor=true
 -- The 2D UI is a modal layer. Consume keyboard events here so movement and
 -- built-in shortcuts (for example Tab) do not leak to the character below.
 hostScript.object.disableKeyEventPassthrough=true
 canvasW,canvasH=game.GetUICanvasSize();viewScale=math.min(1.5,(canvasW-204)/720,(canvasH-60)/480);G.scale=viewScale;offsetX=math.floor((canvasW-720*viewScale)/2);offsetY=math.floor((canvasH-480*viewScale-34)/2)
 stage=container('BattleFactory',hostScript.object);stage:SetSizeDelta(720*viewScale,480*viewScale);stage:SetAnchoredPosition(offsetX,offsetY)
 ui=G.new(container('Interface',stage),'ui');local clip=game.InstantiateClientUIControl(MAP.image,stage);clip.name='BattlefieldEffectClip';clip:SetActive(true);clip:SetAnchorMin(0,0);clip:SetAnchorMax(0,0);clip:SetPivot(0,0);clip:SetImage(Enum.ImageSource.StaticReference,100001);clip.imageColor=G.color('#ffffff00');clip.enableMask=true;G.bounds(clip,0,137*viewScale,720*viewScale,324*viewScale)
 local effectRoot=container('ClippedEffects',clip);effectRoot:SetAnchoredPosition(0,-137*viewScale)
 fx=G.new(container('Effects',effectRoot),'fx');moveFx=G.new(container('MoveEffect',effectRoot),'move-fx');modalStage=container('Modal',hostScript.object);modalStage:SetAnchoredPosition(offsetX,offsetY);modalStage:SetSizeDelta(720*viewScale,480*viewScale);modalUI=G.new(modalStage,'modal');buttonLayer=container('Inputs',hostScript.object);buttonLayer:SetSizeDelta(canvasW,canvasH);buttonLayer.showCursor=true
 historyViewport=game.InstantiateClientUIControl(MAP.image,modalStage);historyViewport.name='HistoryViewport';historyViewport:SetActive(true);historyViewport:SetAnchorMin(0,0);historyViewport:SetAnchorMax(0,0);historyViewport:SetPivot(0,0);historyViewport:SetImage(Enum.ImageSource.StaticReference,100001);historyViewport.imageColor=G.color('#edf0d9');historyViewport.enableMask=true
 historyUI=G.new(historyViewport,'history-line',H.height);historyBar=G.new(container('HistoryScrollbar',modalStage),'history-bar')
 state=newChallenge()
 inputMode=deviceMode();lastDevice=game.GetDevice()
 for _,row in ipairs(N.bindings) do local event,action,index=row[1],row[2],row[3];hostScript.object:AddKeyEventListener(Enum.KeyEventType[event],function()inputMode=event:sub(1,10)=='Controller' and 'controller' or 'keyboard';dispatch(action,index);return true end) end
 draw();print('factory-ready','720x480 HTML layout','native rectangle rendering',true)
end
startEvent=function()
 if shown and shown.kind=='faint' then display[shown.side].present=false end
 queueIndex=queueIndex+1;if queueIndex>queue._n then finishPlayback();return end;eventBefore=F.clone(display);shown=queue[queueIndex-1];local k=shown.kind;display=F.clone(shown.visual or display)
 for side=0,1 do display[side].present=eventBefore[side] and eventBefore[side].present end
 switchRecall=false;switchEntering=false;curePending=k=='cure' and shown.visual and eventBefore[shown.side]~=nil and eventBefore[shown.side].status~=shown.visual[shown.side].status
 if curePending then display[shown.side].status=eventBefore[shown.side].status end
 if k=='switch' then local old=eventBefore[shown.side];local occupied=old and old.present~=false and old.hp>0
  switchEntering=not occupied or old.num~=shown.visual[shown.side].num
  switchRecall=occupied and switchEntering
  if switchRecall then display[shown.side]=F.clone(old) else display[shown.side].present=true end
 end
 moveEffect=nil;if k=='move' then moveEffect={move=shown.move,side=shown.side};for i=queueIndex,queue._n-1 do local next=queue[i];if next.kind=='move' or next.kind=='damage' then break end;if next.kind=='miss' or next.kind=='immune' or next.kind=='blocked' or next.kind=='fail' then moveEffect.miss=true;break end end end
  if k=='move' or k=='switch' or k=='faint' or k=='battle_end' or k=='force' or V.eventDuration(k) then headline=shown.text;message=headline
  elseif k=='effective' or k=='resisted' then local target=shown.visual and shown.visual[1-shown.side];message=headline..'\n对'..(target and target.name or '对手')..(k=='resisted' and '效果不太好……' or '效果绝佳！')
  elseif k~='turn' then if headline=='' then headline=shown.text;message=headline else message=headline..'\n'..shown.text end end
  animationDuration=V.eventDuration(k) or (k=='move' and V.duration(shown.move) or k=='switch' and (switchEntering and .6 or .05) or k=='turn' and .05 or k=='faint' and .45 or k=='damage' and .45 or .5);eventDuration=k=='switch' and not switchEntering and .05 or V.textDuration(shown,motion and animationDuration or 0);eventClock=eventDuration;draw()
end
local function update(dt)
 -- Keep short rendering stalls in the timeline instead of slowing every move.
 -- Bound tab-resume gaps so a suspended page cannot skip the whole battle.
 dt=math.max(0,math.min(dt,.25));clock=clock+dt
 local device=game.GetDevice();if device~=lastDevice then lastDevice=device;inputMode=deviceMode();stickDirection=nil;draw() end
 if inputMode=='controller' then local x,y=game.GetControllerLeftStickAxis();local direction=N.stick(x,y)
  if direction~=stickDirection then stickDirection=direction;stickClock=.35;if direction then dispatch('direction',direction) end
  elseif direction then stickClock=stickClock-dt;if stickClock<=0 then stickClock=.15;dispatch('direction',direction) end end
 end
 if queue then local before=eventClock;eventClock=eventClock-dt
  if curePending and eventDuration-eventClock>=animationDuration*.45 then display[shown.side].status=shown.visual[shown.side].status;curePending=false;draw() end
  if shown and shown.kind=='switch' and switchRecall and eventDuration-before<animationDuration*.35 and eventDuration-eventClock>=animationDuration*.35 then display[shown.side]=F.clone(shown.visual[shown.side]);display[shown.side].present=true;draw() end
  if eventClock<=0 then startEvent() end
 end
 updateSprites();effects()
end
return {start=start,update=update,dispatch=dispatch,state=function()return {phase=state.phase,wins=state.wins,selected=state.selected._n,turn=state.battle and state.battle.turn or 0,busy=queue~=nil,controls=ui and ui.used or 0,screen=overlay and overlay.kind or menu} end}
