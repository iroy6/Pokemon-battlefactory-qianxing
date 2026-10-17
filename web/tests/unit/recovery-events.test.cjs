const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../../src/data/species-data.js'),E=require('../../src/game/engine.js');
function battle(item='lumberry'){
 const base={...D.sets.find(x=>x.num===149),ability:'',item,itemZh:'测试树果'};
 const b=new E.Battle([E.createMon(base),E.createMon(base)],[E.createMon(base)],42);
 b.events=[];b.log=[];return b;
}
test('Berries publish complete pre-consumption and post-cure snapshots in log order',()=>{
 for(const side of [0,1])for(const pair of [['lumberry','tox'],['cheriberry','par'],['chestoberry','slp'],['pechaberry','psn'],['pechaberry','tox'],['rawstberry','brn'],['aspearberry','frz']]){
  const b=battle(pair[0]),m=b.mon(side);m.status=pair[1];m.sleep=3;m.toxic=4;b.checkBerry(side);
  assert.deepEqual(b.events.map(e=>e.kind),['item','cure']);
  assert.ok(b.events[0].visual,'Item events need a playback snapshot');assert.ok(b.events[0].environment);
  assert.equal(b.events[0].visual[side].status,pair[1]);assert.equal(b.events[1].visual[side].status,'');
  assert.equal(b.events[0].side,side);assert.equal(b.events[0].item,pair[0]);
  assert.deepEqual(b.log,b.events);assert.equal(m.itemActive,false);assert.equal(m.sleep,0);assert.equal(m.toxic,0);
  b.checkBerry(side);assert.equal(b.events.length,2);
 }
});
test('Lum and Persim cure confusion, while inapplicable berries remain held',()=>{
 for(const item of ['lumberry','persimberry']){const b=battle(item);b.mon(0).vol.confusion=3;b.checkBerry(0);assert.ok(!b.mon(0).vol.confusion);assert.equal(b.events[0].kind,'item');assert.ok(b.events[0].visual);assert.equal(b.events[1].kind,'cure');}
 for(const item of ['lumberry','persimberry','cheriberry','sitrusberry','liechiberry']){const b=battle(item);b.checkBerry(0);assert.equal(b.events.length,0);assert.equal(b.mon(0).itemActive,true);}
 const b=battle('cheriberry');b.mon(0).status='brn';b.checkBerry(0);assert.equal(b.events.length,0);assert.equal(b.mon(0).itemActive,true);
});
test('HP berries expose old HP before recovery, including stolen berries without consuming the eater item',()=>{
 const b=battle('sitrusberry'),m=b.mon(0);m.hp=40;m.maxhp=100;b.checkBerry(0);
 assert.deepEqual(b.events.map(e=>e.kind),['item','heal']);assert.ok(b.events[0].visual);assert.equal(b.events[0].visual[0].hp,40);assert.equal(b.events[1].visual[0].hp,65);assert.deepEqual(b.events,b.log);
 const c=battle('leftovers');c.mon(0).hp=80;c.mon(0).maxhp=100;assert.equal(c.consumeBerry(0,'sitrusberry',true),true);assert.equal(c.mon(0).hp,100);assert.equal(c.mon(0).itemActive,true);
});
test('Natural Cure announces recovery on the outgoing Pokemon before the switch',()=>{
 const b=battle('');b.mon(0).ability='naturalcure';b.mon(0).abilityZh='自然回复';b.mon(0).status='tox';b.mon(0).sleep=2;b.mon(0).toxic=3;
 b.switch(0,1);assert.deepEqual(b.events.slice(0,3).map(e=>e.kind),['ability','cure','switch']);
 assert.equal(b.events[0].visual[0].status,'tox');assert.equal(b.events[1].visual[0].status,'');assert.equal(b.sides[0].team[0].toxic,0);assert.equal(b.sides[0].team[0].sleep,0);
});
test('Hydration, waking and White Herb retain explicit recovery events',()=>{
 const b=battle('');b.mon(0).ability='hydration';b.mon(0).status='brn';b.weather='rain';b.weatherLeft=3;b.residual();assert.ok(b.events.some(e=>e.kind==='cure'&&e.side===0));
 const c=battle('');c.mon(0).status='slp';c.mon(0).sleep=1;c.beforeMove(0,{id:'protect'});assert.ok(c.events.some(e=>e.kind==='cure'&&e.visual[0].status===''));
 const d=battle('whiteherb');d.mon(0).boosts.def=-1;d.checkHerb(0);assert.deepEqual(d.events.map(e=>e.kind),['item','cure']);assert.equal(d.mon(0).boosts.def,0);
});
