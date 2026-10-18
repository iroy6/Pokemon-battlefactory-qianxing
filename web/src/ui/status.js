/* Read-only view of public battle state. Random hidden expiry rolls are never exposed. */
(function(root){
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={atk:'攻击',def:'防御',spa:'特攻',spd:'特防',spe:'速度',accuracy:'命中',evasion:'闪避'};
const field={safeguard:['神秘守护','防止对手施加主要异常状态与混乱；不解除已有异常。'],reflect:['反射壁','减轻受到的物理伤害。'],lightscreen:['光墙','减轻受到的特殊伤害。'],mist:['白雾','防止对手降低能力等级。'],tailwind:['顺风','本方速度提高。'],stealthrock:['隐形岩','换入宝可梦时受到岩石属性伤害。']};
const row=(name,time,text)=>`<div class="effect-row"><div><b>${esc(name)}</b><span>${esc(time)}</span></div><p>${esc(text)}</p></div>`;
function monEffects(m,own=false){const v=m.vol,rows=[];
if(m.status)rows.push(row(FactoryEngine.statusZh[m.status],['slp','frz'].includes(m.status)?'解除时机不确定':'持续至治愈',({psn:'每回合末受到中毒伤害。',tox:'每回合末受到逐渐增加的剧毒伤害。',brn:'每回合末受到伤害，并影响物理攻击。',par:'速度下降，行动时可能无法动弹。',slp:'暂时无法行动；不公开随机睡眠倒计时。',frz:'暂时无法行动；可能解冻。'})[m.status]));
if(v.paradox)rows.push(row(m.abilityZh,'持续至环境结束或换下',`${names[v.paradox.stat]} ×${v.paradox.stat==='spe'?'1.5':'1.3'}；不占用能力等级。`));
if(v.choiceLock&&m.itemActive&&(own||m.revealedItem))rows.push(row('讲究锁定','换下或失去道具后解除',FactoryEngine.moveName(v.choiceLock)+'；其他招式暂时无法选择。'));
if(v.confusion)rows.push(row('混乱','剩余回合未知','行动时可能攻击自己；换下后解除。'));
if(v.seed!==undefined)rows.push(row('寄生种子','持续至换下','回合末吸取 HP，回复对方。'));
if(v.wrap)rows.push(row('紧束','剩余回合未知','回合末受到伤害，暂时不能主动换人。'));
for(const key of ['disable','encore'])if(v[key])rows.push(row(key==='disable'?'定身法':'再来一次',`剩余 ${v[key].left} 次回合末结算`,`${FactoryEngine.moveName(v[key].id)}${key==='disable'?'暂时无法使用。':'被锁定为使用招式。'}`));
if(v.yawn)rows.push(row('瞌睡',`剩余 ${v.yawn} 次回合末结算`,'届时可能陷入睡眠；换下后解除。'));
if(v.dig)rows.push(row('挖洞蓄力','下次行动','处于地下；下一次行动继续挖洞，暂时不能换人。'));
for(const [key,name,text] of [['foresight','识破','被识破，受到识破相关命中与属性效果影响。'],['minimize','变小','已变小，踩踏会造成更高伤害。'],['flashfire','引火强化','引火已发动，火属性招式威力提高。'],['grudge','怨念','下次行动前，若被直接攻击击倒，可能令该招式 PP 归零。']])if(v[key])rows.push(row(name,key==='grudge'?'至下次行动':'持续至换下',text));
return rows.join('')||'<p class="status-empty">没有持续中的特殊效果。</p>';
}
function render(b){const C=FactoryControls;return `<p class="status-intro">第 ${b.turn} 回合 · 查看不消耗行动。倒计时表示从当前选择行动时起，还会经历多少次回合末结算；随机持续效果不公开内部倒计时。</p><section class="status-section"><h3>${C.icon('Water')}天气与全场效果</h3>${b.weather?row(b.weather==='rain'?'下雨':b.weather==='sun'?'晴天':'沙暴',b.weatherLeft<0?'持续至天气替换或战斗结束':`剩余 ${b.weatherLeft} 回合`,b.weather==='rain'?'水属性招式增强，火属性招式减弱。':b.weather==='sun'?'火属性招式增强，水属性招式减弱；激活相关特性。':'每回合末造成沙暴伤害，部分属性与特性免疫。'):row('正常天气','无倒计时','当前没有天气效果。')}${b.terrain?row('电气场地',`剩余 ${b.terrainLeft} 回合`,'接地者电招式威力提高 30%，不能新陷入睡眠；激活夸克充能。'):''}${b.field.mudsport?row('玩泥',`剩余 ${b.field.mudsport} 回合`,'场上电属性招式威力降低。'):''}${b.field.watersport?row('玩水',`剩余 ${b.field.watersport} 回合`,'场上火属性招式威力降低。'):''}</section><div class="status-sides">${b.sides.map((side,i)=>{const m=b.mon(i);return `<section class="status-section"><h3>${C.icon('ball')}${i?'对方':'我方'} · ${esc(m.name)}</h3><h4>能力等级</h4><div class="boost-grid">${Object.entries(m.boosts).map(([k,n])=>`<div class="boost-cell ${n>0?'up':n<0?'down':''}"><span>${names[k]}</span><b>${n>0?'↑ +':n<0?'↓ ':''}${n}</b><small>×${Number(FactoryEngine.stage(n,['accuracy','evasion'].includes(k)).toFixed(2))}</small></div>`).join('')}</div><p class="status-footnote">倍率仅表示能力等级修正，不含天气、特性、道具或异常状态。</p><h4>本方场地</h4>${Object.entries(side.conditions).filter(([k,n])=>field[k]&&n).map(([k,n])=>row(field[k][0],n<0?'持续至清除或对战结束':`剩余 ${n} 回合`,field[k][1])).join('')||'<p class="status-empty">没有场地效果。</p>'}<h4>异常与特殊效果</h4>${monEffects(m,i===0)}</section>`}).join('')}</div>`}
root.FactoryStatus={render};
})(window);
