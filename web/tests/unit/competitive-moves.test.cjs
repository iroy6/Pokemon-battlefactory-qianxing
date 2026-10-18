const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../../src/data/species-data.js'),M=require('../../src/data/meta.js'),E=require('../../src/game/engine.js');
function battle(move){const s={...D.sets.find(x=>x.num===149),moves:[move,'protect','strength','icebeam'],item:'',ability:''};const t={...D.sets.find(x=>x.num===320),item:'',ability:''};const b=new E.Battle([E.createMon(s)],[E.createMon(t)],44);b.mon(1).hp=b.mon(1).maxhp=5000;b.secondary=(side,chance)=>chance>0;b.events=[];return b;}
test('competitive additions use Gen IX numbers and actual contact classifications',()=>{
 assert.equal(M.moves.dracometeor.power,130);assert.equal(M.moves.poisonjab.power,80);assert.equal(M.moves.scald.power,80);assert.equal(M.moves.shadowsneak.priority,1);
 assert.equal(M.moves.seedbomb.contact,false);assert.equal(M.moves.poisonjab.contact,true);assert.equal(M.moves.flareblitz.contact,true);
});
test('Earth Power and Bug Buzz lower special defense; soundproof blocks Bug Buzz',()=>{
 for(const k of ['earthpower','bugbuzz']){const b=battle(k);b.use(0,k);assert.equal(b.mon(1).boosts.spd,-1);}
 const b=battle('bugbuzz');b.mon(1).ability='soundproof';b.use(0,'bugbuzz');assert.equal(b.mon(1).hp,5000);assert.equal(b.mon(1).boosts.spd,0);
});
test('poison and scald effects, self thaw and target thaw follow their own rules',()=>{
 for(const k of ['poisonjab','sludgewave']){const b=battle(k);b.use(0,k);assert.equal(b.mon(1).status,'psn');}
 const b=battle('scald');b.mon(0).status='frz';b.use(0,'scald');assert.equal(b.mon(0).status,'');assert.equal(b.mon(1).status,'brn');
 const c=battle('scald');c.mon(1).status='frz';c.secondary=()=>false;c.use(0,'scald');assert.equal(c.mon(1).status,'');
});
test('Draco Meteor lowers own special attack; White Herb restores it once',()=>{
 const b=battle('dracometeor');b.rng.chance=()=>true;b.use(0,'dracometeor');assert.equal(b.mon(0).boosts.spa,-2);
 const c=battle('dracometeor');c.rng.chance=()=>true;c.mon(0).item='whiteherb';c.use(0,'dracometeor');assert.equal(c.mon(0).boosts.spa,0);assert.equal(c.mon(0).itemActive,false);
});
test('Flare Blitz has recoil, burn chance and thaw; Rock Head prevents recoil',()=>{
 const b=battle('flareblitz');b.mon(0).status='frz';b.mon(1).hp=30;const hp=b.mon(0).hp;b.use(0,'flareblitz');assert.equal(b.mon(0).status,'');assert.equal(b.mon(0).hp,hp-10);
 const c=battle('flareblitz');c.mon(0).ability='rockhead';const full=c.mon(0).hp;c.use(0,'flareblitz');assert.equal(c.mon(0).hp,full);assert.equal(c.mon(1).status,'brn');
});
