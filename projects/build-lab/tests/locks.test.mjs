import {test} from 'node:test';
import assert from 'node:assert/strict';
import {baseline,normalizeBuild} from '../src/data.js';
import {editRating,changeBody} from '../src/engine/buildModel.js';
const floor={...baseline,ratings:Object.fromEntries(Object.keys(baseline.ratings).map(id=>[id,25])),breakers:{}};
test('locks block direct edits and linked increases or decreases',()=>{
  const locked={...floor,locks:{speed:true}};
  assert.equal(editRating(locked,'speed',60).build.ratings.speed,25);
  const up=editRating(locked,'agility',83);
  assert.equal(up.build.ratings.speed,25);
  assert.equal(up.lockLimited,true);
  const raised=editRating(floor,'agility',83).build;
  const down=editRating({...raised,locks:{agility:true}},'speed',60);
  assert.equal(down.build.ratings.agility,83);
  assert.equal(down.lockLimited,true);
});

test('a locked dependent identifies why a requested decrease is blocked',()=>{
  const raised=editRating(floor,'agility',83).build;
  const down=editRating({...raised,locks:{agility:true}},'speed',60);
  assert.deepEqual(down.blockedBy,['agility']);
});
test('body edits apply despite conflicting locks and release only adjusted locks',()=>{
  const b={
    ...floor,
    ratings:{...floor.ratings,free:25,speed:86,agility:86},
    locks:{free:true,speed:true,agility:true},
  };
  const result=changeBody(b,'position','C');
  assert.equal(result.build.body.position,'C');
  assert.deepEqual(result.releasedLocks.sort(),['agility','speed']);
  assert.equal(result.build.locks.free,true);
  assert.equal(result.build.locks.speed,undefined);
  assert.equal(result.build.locks.agility,undefined);
  assert.ok(result.adjustments.some(({id})=>id==='speed'));
});
test('locks survive build normalization and ignore unrecognized or nonboolean entries',()=>{
  assert.deepEqual(normalizeBuild({...floor,locks:{speed:true,agility:false,other:true,dunk:'true'}}).locks,{speed:true});
});
