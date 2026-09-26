import {test} from 'node:test';
import assert from 'node:assert/strict';
import {baseline,initial,normalizeBuild} from '../src/data.js';
import {editRating,changeBody,buildCaps,overallStatus,minimizeUnlocked} from '../src/engine/buildModel.js';
const floor={...baseline,ratings:Object.fromEntries(Object.keys(baseline.ratings).map(id=>[id,25])),breakers:{}};
test('a real sourced linked increase and decrease update the whole build',()=>{
  const up=editRating(floor,'agility',83);
  assert.equal(up.build.ratings.speed,73);
  assert.ok(up.adjustments.some(a=>a.id==='speed'));
  const down=editRating(up.build,'speed',60);
  assert.equal(down.build.ratings.agility,70);
});
test('body changes clamp ratings and restore linked constraints',()=>{
  const result=changeBody({...floor,ratings:{...floor.ratings,speed:86,agility:86}},'position','C');
  assert.equal(result.build.body.position,'C');
  const caps=buildCaps(result.build.body);
  for(const [id,value] of Object.entries(result.build.ratings))assert.ok(value<=(caps[id]??25));
});
test('imported cap allocations never expand physical caps',()=>{
  const next=normalizeBuild({...baseline,ratings:{...baseline.ratings,close:99,dunk:99},breakers:{close:5,dunk:5}});
  assert.equal(next.ratings.dunk,93);
  assert.equal(next.breakers.close,0);
  assert.equal(next.breakers.dunk,0);
});
test('the reference spread complies with the recovered linked minimums',()=>{
  const status=overallStatus(baseline);
  assert.equal(status.complete,false);
  assert.equal(status.violations.length,0);
});
test('the initial editable example satisfies captured links and keeps the original for comparison',()=>{
  const status=overallStatus(initial);
  assert.equal(status.violations.length,0);
  assert.equal(status.overBudget,false);
  assert.ok(status.available.length>0);
  assert.equal(baseline.ratings.close,77);
});
test('minimize unlocked keeps locks and computes transitive linked minimums',()=>{
  const build={
    ...floor,
    ratings:{...floor.ratings,close:80,post:75,strength:70,free:62},
    breakers:{close:2,post:1,free:3},
    locks:{close:true},
  };
  const rules=[
    {id:'close-post',source:'close',target:'post',steps:[[50,40],[80,60]]},
    {id:'post-strength',source:'post',target:'strength',steps:[[60,45]]},
  ];
  const result=minimizeUnlocked(build,rules);
  assert.equal(result.changed,true);
  assert.equal(result.build.ratings.close,80);
  assert.equal(result.build.ratings.post,60);
  assert.equal(result.build.ratings.strength,45);
  assert.equal(result.build.ratings.free,25);
  assert.equal(result.build.breakers.close,2);
  assert.equal(result.build.breakers.post,1);
  assert.equal(result.build.breakers.free,3);
});
test('minimize unlocked reports an already minimal legal spread',()=>{
  const build={...floor,ratings:{...floor.ratings,close:80,post:60},locks:{close:true}};
  const result=minimizeUnlocked(build,[{source:'close',target:'post',steps:[[80,60]]}]);
  assert.equal(result.changed,false);
  assert.deepEqual(result.build,build);
});

test('overall completion ignores attributes that are intentionally locked',()=>{
  const body={position:'SF',height:82,weight:226,wingspan:88};
  const caps=buildCaps(body);
  const ratings=Object.fromEntries(Object.keys(caps).map(id=>[id,25]));
  const locks={interior:true};
  const status=overallStatus({...floor,body,ratings,locks},undefined);
  assert.equal(status.available.includes('interior'),false);
  assert.equal(status.available.includes('close'),true);
  assert.equal(status.complete,false);
});
