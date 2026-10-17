-- Pixel sprites from pret/pokeemerald. Choreography is a local presentation
-- adaptation, not an emulation of the original ROM's animation scripts.
local A=require('default_import_file/simulator/lua/art/battle_fx')
local C=require('default_import_file/simulator/lua/battle_factory_effect_data')
local X={}
local Baked=require('default_import_file/simulator/lua/art/move_atlases')
local Common=require('default_import_file/simulator/lua/battle_factory_common_fx')
-- Match the action, not merely its elemental type. Each beam also owns its
-- impact sprite, so Psychic/Dragon/Steel attacks cannot end in a water splash.
local beams={flamethrower={'fire','fire_plume'},hydropump={'water_droplet','bubble_burst'},watergun={'water_droplet','bubble_burst'},icebeam={'ice_chunk','ice_spikes'},aurorabeam={'bluegreen_orb','ice_chunk'},psybeam={'pink_orb','ring'},signalbeam={'bluegreen_orb','sparkle_3'},dragonbreath={'wisp_fire','wisp_orb'},flashcannon={'sparkle_3','sparkle_1'},chargebeam={'electricity','electric_orbs'}}
local punches={firepunch='fire',icepunch='ice_chunk',thunderpunch='electricity',machpunch='impact',bulletpunch='sparkle_3',superpower='impact'}
local kicks={blazekick='fire',doublekick='impact',stomp='impact'}
local fangs={firefang='fire',icefang='ice_chunk',thunderfang='electricity',poisonfang='poison_bubble',bite='impact',crunch='impact',bugbite='impact'}
local balls={aurasphere='bluegreen_orb',focusblast='bluegreen_orb',shadowball='wisp_orb',energyball='green_sparkle',moonblast='pink_orb',dragonpulse='wisp_orb',sludgebomb='poison_bubble',gunkshot='toxic_bubble',magnetbomb='sparkle_3',powergem='sparkle_1'}
local powders={sleeppowder={170,200,255,255},poisonpowder={225,160,255,255},stunspore={255,235,90,255},cottonspore={255,255,255,255},sweetscent={255,190,200,255},silverwind={210,235,255,255}}
local function clamp(x)return math.max(0,math.min(1,x)) end
local function smooth(x)x=clamp(x);return x*x*(3-2*x) end
local function stamp(g,name,x,y,size,phase,alpha,tint)
 local a=A[name];if not a then return end
 local f=math.min(#a.ids,1+math.floor(clamp(phase or 0)*(#a.ids-1)));local w=size or a.w;local h=w*a.h/a.w
 local xx,yy=math.floor(x-w/2+.5),math.floor(y-h/2+.5)
 if xx+w<0 or xx>720 or yy+h<19 or yy>342 then return end
 -- Crop-free particles stay inside the battlefield, never across the dialogue.
 if yy<19 then yy=19 end;if yy+h>342 then yy=342-h end
 g:texture(a.ids[f],xx,yy,w,h,{tint and tint[1] or 255,tint and tint[2] or 255,tint and tint[3] or 255,math.floor(clamp(alpha or 1)*255)})
end
X.stamp=stamp
function X.duration(move)return beams[move] and 1.15 or ({surf=true,leafblade=true,dragonclaw=true,calmmind=true})[move] and 1.2 or .95 end
-- Screens occupy the space ahead of the user, not a cage around its body.
function X.screen(g,move,x,y,t,alpha,persistent)
 local name=move=='reflect' and 'blue_light_wall' or move=='barrier' and 'gray_light_wall' or 'green_light_wall'
 local direction=x<360 and 1 or -1;local xx=x+direction*(persistent and 55 or 40)
 local size=persistent and 66 or 102;local opacity=alpha or math.min(1,t*5,(1-t)*5)*.72
 stamp(g,name,xx,y-10,size,0,opacity)
 if not persistent and t>.22 and t<.84 then
  for i=0,2 do local q=clamp((t-.22-i*.1)/.35);if q>0 and q<1 then stamp(g,'sparkle_3',xx-25+i*24,y-42+i*22,20,q,math.sin(q*math.pi)*.7) end end
 end
end
local function impact(g,x,y,t,name,size)
 local p=clamp(t);local fade=math.min(1,p*8,(1-p)*5)
 stamp(g,name or 'impact',x,y,(size or 74)*(.5+.5*math.sin(p*math.pi)),p,fade)
 for i=0,5 do local a=i*math.pi/3;stamp(g,'sparkle_3',x+math.cos(a)*p*55,y+math.sin(a)*p*34,14,p,fade) end
end
function X.hit(g,side,t)impact(g,side==0 and 185 or 565,side==0 and 268 or 150,t,'impact',62) end
function X.move(g,e,t)
 local move,side=e.move,e.side;local kind=C.families[move] or 'impact';local ax,ay=side==0 and 185 or 565,side==0 and 268 or 150
 if move=='ironhead' or move=='zenheadbutt' then kind='impact' end
 local x,y=C.self[move] and ax or side==0 and 565 or 185,C.self[move] and ay or side==0 and 150 or 268
 if e.miss then x=x+(side==0 and 65 or -65);y=y-25 end
 if Common.draw(g,move,side,t,ax,ay,x,y,stamp,e.miss) then return end
 local flight=clamp((t-.12)/.54);local p=smooth(flight);local fade=clamp((1-t)*7)
 if t<.22 and not C.self[move] then stamp(g,'sparkle_3',ax,ay,32,.2+t*2,math.sin(t/.22*math.pi)) end
 if move=='closecombat' then
  for i=0,5 do local q=clamp((t-.08-i*.1)/.32);if q>0 and q<1 then
   stamp(g,'hands_and_feet',x+(i%2==0 and -25 or 25),y-30+(i%3)*23,54,(i%2)*2/(#A.hands_and_feet.ids-1),math.sin(q*math.pi)) end end
 elseif move=='bravebird' then
  for i=0,5 do local q=clamp((t-.1-i*.045)/.52);if q>0 and q<1 then stamp(g,'air_slash',ax+(x-ax)*q,ay+(y-ay)*q,65,q,fade) end end
  if t>.57 and not e.miss then impact(g,x,y,(t-.57)/.43,'impact_2',100) end
 elseif punches[move] or kicks[move] then
  local q=clamp((t-.18)/.65);local alpha=math.sin(q*math.pi)
  -- Emerald hands_and_feet: fist, paw, foot, open hand (not a frame loop).
  stamp(g,'hands_and_feet',x+(side==0 and -1 or 1)*(1-q)*26,y,64,kicks[move] and 2/(#A.hands_and_feet.ids-1) or 0,alpha)
  if t>.32 and not e.miss then impact(g,x,y,(t-.32)/.68,punches[move] or kicks[move],75) end
 elseif balls[move] then
  stamp(g,balls[move],ax+(x-ax)*p,ay+(y-ay)*p-math.sin(p*math.pi)*18,50+10*math.sin(p*math.pi),t,fade)
  if t>.64 and not e.miss then impact(g,x,y,(t-.64)/.36,balls[move],84) end
 elseif move=='swordsdance' then
  for i=0,3 do local a=i*math.pi/2+t*math.pi*2;stamp(g,'sword',ax+math.cos(a)*52,ay+math.sin(a)*14-30*t,28,t,math.sin(t*math.pi)) end
 elseif move=='earthquake' or move=='magnitude' then
  -- Low dust on each platform plus the shared battler shake. Keep the HP
  -- panels unobscured; a screen-wide ring would pass over their lettering.
  for i=0,5 do local q=(t+i*.16)%1;local xx=135+i*19;stamp(g,'gray_smoke',xx,328-q*7,22,q,math.sin(t*math.pi)*(1-q)*.5,{185,165,130});stamp(g,'gray_smoke',xx+380,199-q*7,22,q,math.sin(t*math.pi)*(1-q)*.5,{185,165,130}) end
 elseif move=='tailwind' or move=='mist' or move=='watersport' or move=='mudsport' then
  for i=0,7 do local q=(t+i*.125)%1;local name=move=='tailwind' and 'air_slash' or move=='watersport' and 'water_droplet' or 'gray_smoke'
   stamp(g,name,ax-85+q*170,ay-55+(i%4)*20,move=='mist' and 62 or 30,q,math.sin(t*math.pi)*.7,move=='mudsport' and {165,125,80} or nil)
  end
 elseif move=='megadrain' or move=='gigadrain' or move=='drainpunch' then
  if move=='drainpunch' and t<.4 then stamp(g,'hands_and_feet',x,y,64,0,math.sin(t/.4*math.pi)) end
  for i=0,6 do local q=clamp((t-i*.055)/.65);if q>0 and q<1 then stamp(g,'green_sparkle',x+(ax-x)*q,y+(ay-y)*q,24,q,fade) end end
  if t>.65 then stamp(g,'guard_ring',ax,ay,115,0,math.sin((t-.65)/.35*math.pi),{160,255,170}) end
 elseif move=='bulletseed' or move=='leechseed' then
  for i=0,move=='bulletseed' and 4 or 2 do local q=clamp((t-.08-i*.1)/.5);if q>0 and q<1 then stamp(g,'seed',ax+(x-ax)*q,ay+(y-ay)*q-math.sin(q*math.pi)*25,20,0,fade) end end
 elseif powders[move] then
  for i=0,14 do local q=clamp((t-i*.025)/.62);if q>0 and q<1 then stamp(g,'poison_powder',ax+(x-ax)*q+math.sin(i*2)*24,ay+(y-ay)*q-15+math.cos(i)*30,18,q,fade,powders[move]) end end
 elseif move=='smokescreen' then
  for i=0,6 do local q=clamp((t-i*.05)/.6);stamp(g,'black_smoke',ax+(x-ax)*q+math.sin(i*2)*25,ay+(y-ay)*q,30+q*35,q,math.sin(t*math.pi)*.8) end
 elseif move=='sweetkiss' then
  for i=0,3 do local q=clamp((t-i*.08)/.65);if q>0 and q<1 then stamp(g,'pink_heart_2',ax+(x-ax)*q,ay+(y-ay)*q+math.sin(q*8+i)*18,26,0,fade) end end
 elseif move=='twister' or move=='leafstorm' or move=='heatwave' or move=='icywind' or move=='ominouswind' or move=='whirlwind' then
  local name=move=='leafstorm' and 'leaf' or move=='heatwave' and 'fire' or move=='icywind' and 'ice_chunk' or move=='ominouswind' and 'wisp_orb' or 'air_slash'
  for i=0,15 do local a=i*2.4+t*12;local h=(i*11+t*60)%120;local cx=ax+(x-ax)*p;local cy=ay+(y-ay)*p;stamp(g,name,cx+math.cos(a)*(15+h*.3),cy+35-h,24,t,math.sin(t*math.pi)) end
 elseif move=='willowisp' then
  for i=0,2 do local q=clamp((t-i*.12)/.65);if q>0 and q<1 then stamp(g,'wisp_fire',ax+(x-ax)*q,ay+(y-ay)*q+math.sin(q*9+i)*20,36,q,fade) end end
 elseif move=='grassknot' then
  for i=0,6 do local a=i*math.pi/3+t*3;stamp(g,'leaf',x+math.cos(a)*32,y+35+math.sin(a)*8,30,t,math.sin(t*math.pi)) end
 elseif move=='twineedle' then
  for i=0,1 do local q=clamp((t-i*.25)/.55);if q>0 and q<1 then stamp(g,'claw_slash',ax+(x-ax)*q,ay+(y-ay)*q,36,q,fade) end end
 elseif beams[move] then
  local name=beams[move][1]
  for i=0,13 do local q=i/13;if q<p and q>p-.7 then local xx=ax+(x-ax)*q;local yy=ay+(y-ay)*q+math.sin(q*12+t*20)*3;stamp(g,name,xx,yy,kind=='water' and 25 or 36,(t*2+q)%1,fade) end end
  if t>.58 and not e.miss then impact(g,x,y,(t-.58)/.42,beams[move][2],80) end
 elseif move=='waterfall' then
  for i=0,8 do local q=clamp((t-i*.045)/.65);if q>0 and q<1 then stamp(g,'water_column',x+(i%3-1)*24,y+52-q*115,30,q,fade) end end
  if t>.6 and not e.miss then impact(g,x,y,(t-.6)/.4,'bubble_burst',70) end
 elseif move=='flamewheel' then
  for i=0,7 do local a=i*math.pi/4+t*9;stamp(g,'spinning_fire',ax+(x-ax)*p+math.cos(a)*28,ay+(y-ay)*p+math.sin(a)*28,28,t,math.sin(t*math.pi)) end
 elseif move=='surf' then
  for i=0,11 do local q=(t*1.5-i*.035);if q>0 and q<1 then stamp(g,'water_column',ax+(x-ax)*q+(i%3-1)*20,ay+(y-ay)*q,32,(q*2)%1,fade) end end
  if t>.6 then for i=0,4 do stamp(g,'bubble_burst',x+(i-2)*22,y-10+i%2*20,38,(t-.6)/.4,fade) end end
 elseif move=='discharge' then
  for i=0,11 do local a=i*math.pi/6;local r=p*220;stamp(g,'electricity',ax+math.cos(a)*r,ay+math.sin(a)*r*.5,36,(t+i*.13)%1,fade) end
  if t>.55 and not e.miss then impact(g,x,y,(t-.55)/.45,'electricity',80) end
 elseif kind=='electric' then
  for i=0,8 do local q=i/8;if q<p then stamp(g,'electricity',ax+(x-ax)*q,ay+(y-ay)*q+math.sin(i*2+math.floor(t*14))*8,44,(t*2+i*.13)%1,fade) end end
  if t>.55 and not e.miss then for i=0,3 do stamp(g,'electricity',x+math.cos(i*1.57)*32,y+math.sin(i*1.57)*30,48,(t*3+i*.2)%1,fade) end end
 elseif move=='leafblade' then
  -- Three flowing cuts made from leaves, followed by the original cross impact.
  for pass=0,2 do local q=clamp((t-.12-pass*.22)/.3)
   if q>0 and q<1 then for j=0,5 do local u=clamp(q-j*.045);local a=-2.3+u*3.8+pass*1.6
    stamp(g,'leaf',x+math.cos(a)*58,y+math.sin(a)*40,24,u,.85*(1-j/8)) end end
  end
  if t>.69 and not e.miss then stamp(g,'cross_impact',x,y,88,0,math.sin(clamp((t-.69)/.31)*math.pi)) end
 elseif move=='dragonclaw' then
  if t<.4 then for i=0,5 do local a=i*math.pi/3+t*7;stamp(g,'fire',ax+math.cos(a)*38,ay+math.sin(a)*22,22,t,math.sin(t/.4*math.pi)*.7) end end
  for cut=0,1 do local q=clamp((t-.32-cut*.2)/.38);if q>0 and q<1 then for i=0,2 do stamp(g,'claw_slash',x+(i-1)*20,y+(i-1)*12+(cut==0 and -12 or 12),100,q,math.min(1,(1-q)*7)) end end end
 elseif move=='sacredsword' or move=='secretsword' then
  local q=clamp((t-.15)/.7);stamp(g,'sword',x-50+100*q,y-50+70*q,32,0,math.sin(q*math.pi),move=='secretsword' and {145,215,255} or nil)
  if t>.48 and not e.miss then stamp(g,'cross_impact',x,y,90,0,math.sin(clamp((t-.48)/.52)*math.pi)) end
 elseif move=='ivycudgel' or move=='woodhammer' or move=='gigatonhammer' then
  -- Heavy descending strike: leaf/wood fragments or metal glints, no claw trail.
  local q=clamp((t-.12)/.46);local xx=x+(1-q)*(side==0 and -45 or 45);local yy=y-82+q*82
  if q<1 then stamp(g,move=='gigatonhammer' and 'impact_2' or 'rocks',xx,yy,40+q*28,0,math.sin(t*math.pi),move=='gigatonhammer' and {195,210,235} or {155,210,95}) end
  if t>.5 and not e.miss then impact(g,x,y,(t-.5)/.5,'impact_2',112);for i=0,5 do local a=i*math.pi/3;local r=(t-.5)*130;stamp(g,move=='gigatonhammer' and 'sparkle_3' or 'leaf',x+math.cos(a)*r,y+math.sin(a)*r*.6,24,t,fade) end end
 elseif move=='torchsong' then
  for i=0,4 do local q=clamp((t-.1-i*.075)/.55);if q>0 and q<1 then local xx=ax+(x-ax)*q;local yy=ay+(y-ay)*q+math.sin(q*9+i)*13;stamp(g,'fire',xx,yy,36,q,fade);stamp(g,'music_notes',xx,yy-12,22,i/6,fade) end end
  if t>.65 and not e.miss then impact(g,x,y,(t-.65)/.35,'fire_plume',80) end
 elseif move=='calmmind' then
  -- Emerald concentration: inward pulses, not rising recovery sparkles.
  for i=0,2 do local q=clamp((t-i*.18)/.55);if q>0 and q<1 then stamp(g,'thin_ring',ax,ay-10,150*(1-q)+16,0,math.sin(q*math.pi)*.8,{205,170,255}) end end
  if t>.55 then stamp(g,'pink_orb',ax,ay-12,22,0,math.sin(clamp((t-.55)/.45)*math.pi)*.7) end
 elseif move=='quiverdance' then
  for i=0,7 do local a=i*math.pi/4+t*5;stamp(g,'poison_powder',ax+math.cos(a)*50,ay+math.sin(a)*32-16*t,22,t,math.sin(t*math.pi),{220,185,255}) end
 elseif move=='reflect' or move=='lightscreen' or move=='barrier' then X.screen(g,move,ax,ay,t)
 elseif move=='protect' or move=='safeguard' then
  -- A single broad, fixed-size shell fades in/out. Never squeezes the battler.
  stamp(g,'protect',ax+(side==0 and 18 or -18),ay-8,128,0,math.min(1,t*5,(1-t)*5)*.72)
 elseif move=='detect' then stamp(g,'sparkle_3',ax+(side==0 and 22 or -22),ay-30,60,t,math.sin(t*math.pi))
 elseif kind=='slash' or move=='nightslash' or move=='shadowclaw' or move=='xscissor' or move=='kowtowcleave' then
  for i=0,2 do local q=clamp((t-.18-i*.1)/.5);if q>0 then stamp(g,i%2==0 and 'claw_slash' or 'air_slash',x+(i-1)*19,y+(i-1)*8,95,q,math.min(1,(1-q)*6)) end end
 elseif kind=='bite' or fangs[move] then
  local q=clamp((t-.2)/.6);local gap=(1-math.sin(q*math.pi))*24
  stamp(g,'fangs',x,y-gap,90,0,math.sin(q*math.pi));stamp(g,'fangs',x,y+gap,90,1,math.sin(q*math.pi))
  if t>.5 and not e.miss then impact(g,x,y,(t-.5)/.5,fangs[move] or 'impact',76) end
 elseif kind=='rock' or kind=='dig' then
  for i=0,6 do local q=clamp((t-i*.055)/.65);if q>0 and q<1 then local yy=kind=='dig' and y+35-math.sin(q*math.pi)*80 or y-80+q*115;stamp(g,'rocks',x+(i-3)*18,yy,32+(i%2)*10,i/8,fade) end end
  if t>.65 and not e.miss then impact(g,x,y,(t-.65)/.35,'impact',65) end
 elseif kind=='shield' or move=='detect' or move=='safeguard' then
  for i=0,4 do stamp(g,'guard_ring',x,y-35+i*16,100+math.sin(t*math.pi)*30,0,fade*.8) end
 elseif kind=='heal' or kind=='boost' then
  stamp(g,'guard_ring',x,y+30,130,0,math.sin(t*math.pi))
  for i=0,8 do local q=(t+i*.13)%1;stamp(g,kind=='heal' and 'green_sparkle' or 'sparkle_1',x+math.sin(i*2.4)*48,y+35-q*100,26,q,math.min(1,t*6,fade)) end
 elseif kind=='sound' or move=='grasswhistle' or move=='growl' then
  local musical=move=='sing' or move=='grasswhistle'
  for i=0,5 do local q=clamp((t-i*.06)/.7);if q>0 and q<1 then stamp(g,musical and 'music_notes' or 'ring',ax+(x-ax)*q,ay+(y-ay)*q+math.sin(q*8+i)*18,musical and 30 or 25+q*55,i/6,fade) end end
 elseif kind=='psychic' or kind=='wind' or kind=='vine' then
  for i=0,4 do local q=clamp((t-i*.08)/.65);if q>0 and q<1 then stamp(g,kind=='psychic' and 'ring' or kind=='vine' and 'guard_ring' or 'air_slash',ax+(x-ax)*q,ay+(y-ay)*q,40+q*70,q,fade) end end
 elseif kind=='sun' then stamp(g,'sparkle_3',540,70,100,.5,math.sin(t*math.pi))
 elseif kind=='weather' or kind=='sand' or kind=='terrain' then
  for i=0,17 do stamp(g,kind=='sand' and 'rocks' or kind=='terrain' and 'electricity' or 'water_droplet',(i*71+t*160)%720,kind=='terrain' and 320 or 25+(i*43+t*150)%280,kind=='terrain' and 22 or 15,(t+i*.1)%1,math.min(1,t*6,fade)) end
 elseif kind=='impact' then
  if t>.2 and not e.miss then impact(g,x,y,(t-.2)/.8,'impact',move=='superpower' and 105 or 78) end
 elseif kind=='debuff' or kind=='copy' then
  for i=0,6 do local a=i*math.pi/3+t*2;stamp(g,'pink_orb',x+math.cos(a)*42,y+math.sin(a)*24,14,(t+i*.1)%1,math.min(1,t*5,fade)) end
 else
  local name=kind=='flame' and 'fire' or kind=='water' and 'bubble' or kind=='leaf' and 'leaf' or kind=='poison' and 'poison_bubble' or kind=='ice' and 'ice_chunk' or kind=='ghost' and 'wisp_orb' or kind=='star' and 'sparkle_3' or kind=='dragon' and 'wisp_fire' or 'green_sparkle'
  if move=='razorleaf' or move=='leafblade' then name='razor_leaf' end
  local count=(move=='shadowball' or move=='energyball' or move=='moonblast') and 1 or 8
  for i=0,count-1 do local q=clamp((t-.1-i*.04)/.58);if q>0 and q<1 then local arc=count==1 and -math.sin(q*math.pi)*18 or math.sin(i*1.7+q*8)*16;stamp(g,name,ax+(x-ax)*q,ay+(y-ay)*q+arc,count==1 and 62 or 32,(t*2+i*.17)%1,fade) end end
  if t>.6 and not e.miss then impact(g,x,y,(t-.6)/.4,kind=='water' and 'bubble_burst' or kind=='flame' and 'fire_plume' or kind=='poison' and 'poison_bubble' or name,82) end
 end
end
local procedural=X.move
function X.prewarm(g,events,first)
 local count=0
 for i=math.max(0,first),events._n-1 do local e=events[i];local entry=e.kind=='move' and Baked[e.move]
  if entry then
   local miss=false;for j=i+1,events._n-1 do local n=events[j];if n.kind=='move' or n.kind=='damage' then break end;if n.kind=='miss' or n.kind=='immune' or n.kind=='blocked' or n.kind=='fail' then miss=true;break end end
   local frame=entry.frames[(e.side or 0)*2+(miss and 2 or 1)][1];g:texture(frame[1],0,20,1,1,'#ffffff00');count=count+1;if count>=2 then break end
  end
 end
end
X.duration=function(move)return Baked[move] and Baked[move].duration or 1.08 end
X.move=function(g,e,t)
 local entry=Baked[e.move]
 if not entry then return procedural(g,e,t) end
 local rows=entry.frames[(e.side or 0)*2+(e.miss and 2 or 1)]
 local frame=rows[math.min(#rows,1+math.floor(clamp(t)*(#rows-1)))]
 -- One retained image instead of dozens of independently changing controls.
 g:texture(frame[1],frame[2],frame[3],frame[4],frame[5])
end
return X
