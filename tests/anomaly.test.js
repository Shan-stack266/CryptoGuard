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
