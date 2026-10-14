import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAnomaly } from '../server/anomaly.js'
const baseline = Array.from({ length: 30 }, (_, i) => ({ source: 'Application', decision: 'Allowed', operation: 'POST /api/ciphers', requests: 10 + i % 3, payload: 0.5 + i % 4 / 10, failures: 0 }))
test('Model stays untrained below twenty legitimate observations', () => {
  assert.equal(detectAnomaly({}, baseline.slice(0, 19)).status, 'Collecting baseline')
  assert.equal(detectAnomaly({}, baseline.map((row) => ({ ...row, decision: 'Blocked' }))).samples, 0)
})
test('Learned kNN baseline distinguishes familiar activity from an outlier', () => {
  const normal = detectAnomaly({ requests: 11, payload: 0.6, failures: 0 }, baseline)
  assert.equal(normal.status, 'Ready'); assert.equal(normal.anomalous, false)
  const unusual = detectAnomaly({ requests: 1000, payload: 4000, failures: 0 }, baseline)
  assert.equal(unusual.anomalous, true); assert.ok(unusual.novelty > unusual.threshold)
})
test('Constant features remain finite and reject a material deviation', () => {
  const rows = baseline.map((row) => ({ ...row, requests: 1, payload: 0 }))
  assert.equal(detectAnomaly({ requests: 1, payload: 0 }, rows).anomalous, false)
  assert.equal(detectAnomaly({ requests: 200, payload: 100 }, rows).anomalous, true)
})


test('Normal cipher saves are not compared with body-free dashboard polling', () => {
  const polling=baseline.map(row=>({...row,operation:'GET /api/state',requests:2,payload:0}))
  const first=detectAnomaly({operation:'POST /api/ciphers',requests:2,payload:0.2},polling)
  assert.equal(first.status,'Collecting baseline');assert.equal(first.samples,0);assert.equal(first.anomalous,false)
  const learned=detectAnomaly({operation:'POST /api/ciphers',requests:11,payload:0.6},[...polling,...baseline])
  assert.equal(learned.status,'Ready');assert.equal(learned.samples,30);assert.equal(learned.anomalous,false)
  const unusual=detectAnomaly({operation:'POST /api/ciphers',requests:1000,payload:4000},[...polling,...baseline])
  assert.equal(unusual.anomalous,true)
})
