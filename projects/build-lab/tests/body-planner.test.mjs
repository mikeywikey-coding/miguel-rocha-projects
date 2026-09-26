import {test} from 'node:test';
import assert from 'node:assert/strict';
import {baseline} from '../src/data.js';
import {changeBody} from '../src/engine/buildModel.js';
test('body planner applies all size fields in one transaction',()=>{
 const body={position:'PG',height:75,weight:198,wingspan:78};
 const result=changeBody(baseline,body);
 assert.deepEqual(result.build.body,body);
 assert.equal(baseline.body.position,'SF');
});
