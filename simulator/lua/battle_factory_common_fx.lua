-- Move-specific counterpart of prototype/common-choreography.js.
-- Pure presentation, bounded retained controls, no battle RNG or timers.
local X={}
local supported={};for k in ('icebeam hydropump watergun scald flamethrower thunderbolt psychic psyshock dragondance swordsdance drainpunch gigadrain megadrain closecombat bravebird rockslide stoneedge earthpower darkpulse bugbuzz flareblitz seedbomb sludgewave dracometeor poisonjab shadowsneak'):gmatch('%S+') do supported[k]=true end
local function clamp(n)return math.max(0,math.min(1,n))end
local bolt={0,10,-10,7,-9,6,-4,0}
function X.draw(g,move,side,t,ax,ay,x,y,stamp,miss)
 if not supported[move] then return false end
 local fade=math.min(1,t*7,(1-t)*7);local p=clamp((t-.15)/.45);local dir=side==0 and 1 or -1
 local function art(name,xx,yy,size,phase,alpha)stamp(g,name,xx,yy,size,phase,alpha)end
 local function pixel(xx,yy,size,color,alpha)
  if alpha<=0 then return end
  local r=tonumber(color:sub(2,3),16);local gg=tonumber(color:sub(4,5),16);local b=tonumber(color:sub(6,7),16)
  g:rect(math.floor(xx-size/2+.5),math.floor(yy-size/2+.5),size,size,{r,gg,b,math.floor(clamp(alpha)*255)})
 end
 local function burst(name,size,start)
  start=start or .58;if t>start and not miss then local q=(t-start)/(1-start);art(name,x,y,size*(.7+.3*math.sin(q*math.pi)),q,math.sin(q*math.pi))end
 end
 if move=='icebeam' or move=='hydropump' or move=='watergun' or move=='scald' or move=='flamethrower' then
  local ice=move=='icebeam';local fire=move=='flamethrower';local wide=move=='hydropump';local steam=move=='scald'
  local size=ice and 9 or fire and 24 or wide and 22 or 11;local color=ice and '#b7f4ff' or fire and '#ff9b42' or '#69c5f4'
  if t>.12 and t<.84 then for i=0,39 do local q=i/39;if q>p then break end;local xx=ax+(x-ax)*q;local yy=ay+(y-ay)*q
   pixel(xx,yy,size+(ice and 3 or 7),color,fade*.65);pixel(xx,yy,ice and 10 or wide and 10 or 5,ice and '#ffffff' or fire and '#fff3a0' or '#dcfaff',fade)
   if i%5==0 then art(ice and 'sparkle_1' or fire and 'fire' or 'water_droplet',xx,yy+math.sin(q*18-t*16)*(ice and 3 or 7),ice and 13 or wide and 32 or 22,(t*2+q)%1,fade) end
  end end
  burst(ice and 'ice_spikes' or fire and 'fire_plume' or 'bubble_burst',ice and 70 or wide and 95 or 60)
  if steam and t>.4 then for i=0,3 do local q=clamp((t-.4-i*.05)/.45);art('gray_smoke',x+(i-1.5)*15,y-50*q,26+q*15,q,math.sin(q*math.pi)*.6) end end
 elseif move=='thunderbolt' then
  if t<.3 then for i=0,3 do art('electric_orbs',ax+(i-1.5)*12,ay-18,20,t,math.sin(t/.3*math.pi)) end end
  if t>.26 and t<.84 then for i=0,34 do local q=i/34;local k=math.min(6,math.floor(q*7));local f=q*7-k;local yy=y-95+q*95;local xx=x+(bolt[k+1]+(bolt[k+2]-bolt[k+1])*f)*(math.floor(t*14)%2==1 and 1 or -1);pixel(xx,yy,9,'#edb538',fade);pixel(xx,yy,6,'#fff7b5',fade) end end
  burst('electricity',85,.35)
 elseif move=='psychic' then
  for i=0,3 do local q=clamp((t-i*.12)/.55);if q>0 and q<1 then art('ring',x,y,150-100*q,q,math.sin(q*math.pi)*.65) end end;burst('pink_orb',60,.55)
 elseif move=='psyshock' then
  for i=0,4 do local q=clamp((t-.12-i*.085)/.45);if q>0 and q<1 then art('pink_orb',ax+(x-ax)*q+(i-2)*7,ay+(y-ay)*q-math.sin(q*math.pi)*40,28,q,fade) end end;burst('cross_impact',82,.53)
 elseif move=='dragondance' then
  for i=0,7 do local a=i*math.pi/4+t*9;local r=48-12*math.sin(t*math.pi);art(i%2==1 and 'wisp_fire' or 'bluegreen_orb',ax+math.cos(a)*r,ay+math.sin(a)*23-30*t,22,t,fade) end
 elseif move=='swordsdance' then
  for i=0,3 do local a=i*math.pi/2+t*math.pi*2;art('sword',ax+math.cos(a)*52,ay+math.sin(a)*14-30*t,28,t,math.sin(t*math.pi)) end
 elseif move=='drainpunch' or move=='megadrain' or move=='gigadrain' then
  if move=='drainpunch' and t<.38 then art('hands_and_feet',x,y,64,0,math.sin(t/.38*math.pi)) end
  for i=0,6 do local q=clamp((t-.3-i*.045)/.42);if q>0 and q<1 then art('green_sparkle',x+(ax-x)*q,y+(ay-y)*q-math.sin(q*math.pi)*20,20,q,fade) end end
  if t>.72 then art('green_sparkle',ax,ay,65,(t-.72)/.28,math.sin((t-.72)/.28*math.pi)) end
 elseif move=='closecombat' then
  for i=0,5 do local q=clamp((t-.08-i*.1)/.32);if q>0 and q<1 then art('hands_and_feet',x+(i%2==0 and -25 or 25),y-30+i%3*23,54,i%2*2/3,math.sin(q*math.pi)) end end
 elseif move=='bravebird' or move=='flareblitz' then
  for i=0,6 do local q=clamp((t-.1-i*.035)/.5);if q>0 and q<1 then art(move=='bravebird' and 'air_slash' or 'spinning_fire',ax+(x-ax)*q,ay+(y-ay)*q,65,q,fade) end end;burst(move=='bravebird' and 'impact' or 'fire_plume',100,.57)
 elseif move=='earthpower' then
  for i=0,6 do local q=clamp((t-.08-i*.045)/.55);if q>0 and q<1 then local xx=x+(i-3)*15;local yy=y+35-math.sin(q*math.pi)*62;art('rocks',xx,yy,23,i/7,math.sin(q*math.pi));pixel(xx,y+35-q*50,11,'#d99a46',math.sin(q*math.pi)*.7);pixel(xx,y+35-q*50,6,'#ffe697',math.sin(q*math.pi)) end end
  burst('impact',70,.35);burst('gray_smoke',100,.58)
 elseif move=='rockslide' or move=='stoneedge' or move=='dracometeor' then
  for i=0,5 do local q=clamp((t-.1-i*.065)/.5);if q>0 and q<1 then local rising=move=='stoneedge' or move=='earthpower';local xx=x+(i-2.5)*19;local yy=rising and y+40-q*100 or y-95+q*125
   art(move=='dracometeor' and 'wisp_fire' or 'rocks',xx,yy,move=='stoneedge' and 36 or 44,i/6,math.sin(q*math.pi))end end;burst('impact',85,.62)
 elseif move=='darkpulse' or move=='bugbuzz' then
  for i=0,4 do local q=clamp((t-.08-i*.09)/.55);if q>0 and q<1 then art(move=='darkpulse' and 'wisp_orb' or 'ring',ax+(x-ax)*q,ay+(y-ay)*q,30+q*60,q,fade) end end
 elseif move=='seedbomb' then
  local q=clamp((t-.1)/.5);if q<1 then art('seed',ax+(x-ax)*q,ay+(y-ay)*q-math.sin(q*math.pi)*65,40,0,fade)end;burst('impact',85)
 elseif move=='sludgewave' then
  for i=0,15 do local q=clamp((t-.06-i*.025)/.58);if q>0 and q<1 then art('poison_bubble',ax+(x-ax)*q,ay+(y-ay)*q+math.sin(i*2+q*8)*23,34,q,fade) end end
 elseif move=='poisonjab' then
  local q=clamp((t-.2)/.45);art('hands_and_feet',x-dir*(1-q)*45,y,50,1,math.sin(q*math.pi));burst('poison_bubble',64,.4)
 elseif move=='shadowsneak' then
  for i=0,11 do local q=i/11;if q<p then art('black_smoke',ax+(x-ax)*q,ay+(y-ay)*q+35,35,q,fade*.8)end end;burst('claw_slash',76,.52)
 end
 return true
end
return X
