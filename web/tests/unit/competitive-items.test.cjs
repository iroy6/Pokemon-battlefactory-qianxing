const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../../src/data/species-data.js'),M=require('../../src/data/meta.js'),E=require('../../src/game/engine.js');
function battle(item){const s={...D.sets.find(x=>x.num===149),item,ability:'',moves:['strength','icebeam','protect','doublekick']};const foe={...D.sets.find(x=>x.num===320),item:'',ability:''};const b=new E.Battle([E.createMon(s),E.createMon(s)],[E.createMon(foe)],42);b.events=[];return b;}
test('Choice items boost only the appropriate stat and lock the first executed move',()=>{
 for(const item of ['choiceband','choicespecs','choicescarf']){const b=battle(item),plain=battle('');const p=b.calculate(0,M.moves.strength,{roll:100}),q=plain.calculate(0,M.moves.strength,{roll:100}),sp=b.calculate(0,M.moves.icebeam,{roll:100}),sq=plain.calculate(0,M.moves.icebeam,{roll:100});
 assert.ok(item==='choiceband'?p>q*1.4:p===q);assert.ok(item==='choicespecs'?sp>sq*1.4:sp===sq);assert.equal(b.speed(0),item==='choicescarf'?Math.floor(plain.speed(0)*1.5):plain.speed(0));
 b.use(0,'protect');assert.equal(b.choices(0).length,1);assert.equal(b.choices(0)[0].id,'protect');b.mon(0).moves[2].pp=0;assert.equal(b.choices(0).length,0);
 b.mon(0).itemActive=false;assert.equal(b.choices(0).length,3);
 }
});
test('Choice lock resets after switching and does not lock sleep or flinch failures',()=>{
 const b=battle('choiceband');b.mon(0).status='slp';b.mon(0).sleep=3;b.use(0,'strength');assert.equal(b.choices(0).length,4);b.mon(0).status='';b.use(0,'strength');assert.equal(b.choices(0).length,1);b.switch(0,1);b.switch(0,0);assert.equal(b.choices(0).length,4);
});
test('Focus Sash protects only one hit and does not stop later hits or residual damage',()=>{
 const b=battle('');const target=b.mon(1);target.item='focussash';target.itemActive=true;target.hp=target.maxhp=20;b.use(0,'doublekick');assert.equal(target.hp,0);assert.equal(target.itemActive,false);assert.equal(b.events.filter(e=>e.kind==='item').length,1);b.damage(1,4,'中毒',false);assert.equal(target.hp,0);
 const c=battle('');c.mon(1).item='focussash';c.mon(1).hp=5;c.use(0,'strength');assert.equal(c.mon(1).hp,0);
 const d=battle('');d.mon(1).item='focussash';d.damage(1,9999,'沙暴',false);assert.equal(d.mon(1).hp,0);
});
test('Focus Sash survives a single lethal hit and remains held after nonlethal moves',()=>{
 const b=battle('');b.mon(1).item='focussash';b.mon(1).hp=b.mon(1).maxhp=10;b.use(0,'strength');assert.equal(b.mon(1).hp,1);assert.equal(b.mon(1).itemActive,false);
 const c=battle('');c.mon(1).item='focussash';c.mon(1).hp=c.mon(1).maxhp=10000;c.use(0,'strength');assert.equal(c.mon(1).itemActive,true);assert.ok(!c.mon(1).vol.sashMove);
});
