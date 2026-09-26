import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as model from '../src/engine/buildModel.js';
import {attributeIds,getOverall} from '../src/engine/gameRules.js';

const build=()=>({body:{position:'SF',height:81,weight:185,wingspan:84},ratings:Object.fromEntries(attributeIds.map(id=>[id,25])),breakers:{},locks:{}});
test('next point cost prices the full linked spread without changing the build',()=>{
  assert.equal(typeof model.attributeIncreaseCosts,'function');
  const b=build(),before=structuredClone(b);
  const rules=[{source:'dunk',target:'vertical',steps:[[26,40]]},{source:'vertical',target:'strength',steps:[[40,35]]}];
  const cost=model.attributeIncreaseCosts(b,rules).dunk;
  const expected={...b.ratings,dunk:26,vertical:40,strength:35};
  assert.equal(cost.status,'available');
  assert.equal(cost.to,26);
  assert.equal(cost.overallDelta,getOverall(expected,81).uncapped-getOverall(b.ratings,81).uncapped);
  assert.deepEqual(cost.adjustments.map(a=>a.id).sort(),['strength','vertical']);
  assert.deepEqual(b,before);
  assert.equal(model.attributeIncreaseCosts({...b,breakers:{dunk:5}},rules).dunk.overallDelta,cost.overallDelta);
});
test('cost previews explain body, locks, linked caps, and inconsistent imports',()=>{
  assert.equal(typeof model.attributeIncreaseCosts,'function');
  const b=build();
  b.ratings.speed=model.buildCaps(b.body).speed;
  assert.equal(model.attributeIncreaseCosts(b,[]).speed.status,'body');
  b.locks.vertical=true;
  const rules=[{source:'dunk',target:'vertical',steps:[[26,40]]}];
  const locked=model.attributeIncreaseCosts(b,rules).dunk;
  assert.equal(locked.status,'locked');
  assert.deepEqual(locked.lockedAttributes,['vertical']);
  assert.ok(locked.overallDelta>0);
  assert.equal(model.attributeIncreaseCosts(b,[{source:'dunk',target:'speed',steps:[[26,99]]}]).dunk.status,'linked-cap');
  b.ratings.dunk=26;
  assert.equal(model.attributeIncreaseCosts(b,rules).free.status,'invalid');
});
test('an over-budget upgrade keeps its visible hypothetical cost',()=>{
  assert.equal(typeof model.attributeIncreaseCosts,'function');
  const b=build(); b.ratings=model.usableCaps(b.body); b.ratings.close--;
  const cost=model.attributeIncreaseCosts(b,[]).close;
  assert.equal(cost.status,'budget');
  assert.ok(cost.overallDelta>0);
  assert.ok(cost.afterOverall>99);
});
