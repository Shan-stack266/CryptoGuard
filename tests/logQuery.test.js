import test from 'node:test'
import assert from 'node:assert/strict'
import {logQuery} from '../server/logQuery.js'
const user={id:'test-owner'}
test('Log query uses UTC date boundaries, validated pagination and forced ownership',()=>{
 const spec=logQuery(new URLSearchParams({kind:'activity',page:'2',size:'20',start:'2026-10-13',end:'2026-10-14',operation:'Login',status:'Failed'}),user,false)
 assert.equal(spec.filters.user_id,'test-owner');assert.equal(spec.page,2);assert.equal(spec.start,'2026-10-13T00:00:00Z');assert.equal(spec.end,'2026-10-14T23:59:59.999Z')
 assert.equal(spec.filters.operation,'Login');assert.equal(spec.filters.decision,'Failed')
})
test('Log query rejects unauthorized categories, invalid page sizes and reversed dates',()=>{
 for(const kind of ['account','security','model','alerts'])assert.throws(()=>logQuery(new URLSearchParams({kind}),user,false),/Administrator/)
 for(const params of [{kind:'bad'},{page:'0'},{size:'101'},{start:'bad'},{start:'2026-10-14',end:'2026-10-13'}])assert.throws(()=>logQuery(new URLSearchParams(params),user,true))
})
