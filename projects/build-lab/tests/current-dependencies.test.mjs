import test from 'node:test';
import assert from 'node:assert/strict';
import {attributeIds,getRules} from '../src/engine/gameRules.js';
import {applyAttributeChange} from '../src/engine/dependencies.js';
import {editRating,overallStatus} from '../src/engine/buildModel.js';
import {capSequence} from '../src/engine/capProjections.js';
import {O as clientLinks} from '../research/locker-chunks/We27uoMs.js';

const vector=values=>Object.fromEntries(attributeIds.map((id,i)=>[id,values[i]]));
const blank=vector(Array(21).fill(25)),caps=vector(Array(21).fill(99));
const body={position:'SF',height:81,weight:185,wingspan:84};
const screenshot={body,ratings:vector([77,66,82,57,42,87,83,63,70,70,61,80,86,60,88,75,80,85,85,75,83]),breakers:{},locks:{}};

test('Mid-Range raises Post Control at the recovered boundary, with reversible prerequisites',()=>{
  const rules=getRules(81);
  for(const [mid,post] of [[80,25],[81,26],[87,32]]){
    const result=applyAttributeChange({ratings:blank,caps,rules,attribute:'mid',value:mid});
    assert.equal(result.ratings.mid,mid);
    assert.equal(result.ratings.post,post,`Mid-Range ${mid}`);
    assert.equal(result.ratings.close,mid-10);
  }
  const raised=applyAttributeChange({ratings:blank,caps,rules,attribute:'mid',value:87});
  const lowered=applyAttributeChange({ratings:raised.ratings,caps,rules,attribute:'post',value:31});
  assert.equal(lowered.ratings.mid,86);
});

test('all recovered dependency thresholds agree with the client across every supported height',()=>{
  for(const [height,rows] of Object.entries(clientLinks)){
    const rules=getRules(Number(height));
    assert.equal(rules.length,rows.length,`height ${height}`);
    for(const [source,target,delta] of rows){
      const rule=rules.find(r=>r.source===attributeIds[source]&&r.target===attributeIds[target]);
      assert.ok(rule,`${height}: ${source} -> ${target}`);
      for(let rating=25;rating<=99;rating++){
        const minimum=rule.steps.findLast(([threshold])=>rating>=threshold)?.[1]??25;
        assert.equal(minimum,Math.max(25,rating-delta),`${height}: ${source}->${target} at ${rating}`);
      }
    }
  }
});

test('supplied in-game spread is legal and Post Control 47 can be lowered to 42 without collateral changes',()=>{
  assert.deepEqual(overallStatus(screenshot).violations,[]);
  const result=editRating({...screenshot,ratings:{...screenshot.ratings,post:47}},'post',42);
  assert.deepEqual(result.build.ratings,screenshot.ratings);
  assert.deepEqual(result.adjustments,[]);
  assert.equal(result.constrained,false);
});

test('all 105 cap-breaker steps match the September 13 supplied game screenshot',()=>{
  const expected=[
    [3,3,3,2,2],[6,5,5,4,3],[3,2,2,2,2],[3,3,2,2,2],[11,9,7,6,6],
    [1,1,0,0,0],[1,1,1,0,0],[7,6,5,5,4],[3,3,3,2,2],[5,5,0,0,0],
    [8,6,0,0,0],[1,1,1,1,1],[1,1,1,0,0],[1,1,1,1,1],[1,1,1,0,0],
    [3,0,0,0,0],[0,0,0,0,0],[1,0,0,0,0],[1,0,0,0,0],[0,0,0,0,0],[1,1,1,1,1],
  ];
  attributeIds.forEach((id,i)=>assert.deepEqual(capSequence(screenshot,id),expected[i],id));
});
