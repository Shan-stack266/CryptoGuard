import test from 'node:test'
import assert from 'node:assert/strict'
import { analyzeActivity, defaultPolicies, validatePolicies, isIPv4, initialSecurityState, reportRows, csvExport, withinDates } from '../src/utils/securityLab.js'
const clean = { identity: 'tester', ip: '192.0.2.10', failures: 0, requests: 20, payload: 64, unknownDevice: false }

test('Risk scoring explains signals, caps score, and respects exact boundaries', () => {
  assert.equal(analyzeActivity(clean, defaultPolicies).decision, 'Allowed')
  const result = analyzeActivity({ ...clean, failures: 8, requests: 121, payload: 1025, unknownDevice: true }, defaultPolicies)
  assert.equal(result.score, 100)
  assert.equal(result.reasons.reduce((sum, reason) => sum + reason.points, 0), 125)
  assert.equal(result.decision, 'Blocked')
  assert.equal(result.createAlert, true)
  assert.equal(analyzeActivity({ ...clean, failures: 4, requests: 120, payload: 1024 }, defaultPolicies).score, 40)
  assert.equal(analyzeActivity({ ...clean, failures: 5 }, defaultPolicies).decision, 'Blocked')
  const transfer = { ...clean, requests: 121, payload: 1025, unknownDevice: true }
  assert.equal(analyzeActivity(transfer, { ...defaultPolicies, autoBlock: false }).decision, 'Challenged')
  assert.equal(analyzeActivity(transfer, { ...defaultPolicies, autoBlock: true }).decision, 'Blocked')
})
test('IP blocks and emergency policy override a low score and produce alerts', () => {
  for (const result of [analyzeActivity(clean, defaultPolicies, [{ ip: clean.ip }]), analyzeActivity(clean, { ...defaultPolicies, emergency: true })]) {
    assert.equal(result.score, 0)
    assert.equal(result.decision, 'Blocked')
    assert.equal(result.createAlert, true)
    assert.equal(result.controls.length, 1)
  }
})
test('Policy changes apply to activity decisions and reject invalid ranges', () => {
  const policy = validatePolicies({ ...defaultPolicies, maxFailures: '3', alertThreshold: '20', blockThreshold: '40' })
  assert.equal(analyzeActivity({ ...clean, failures: 2 }, policy).decision, 'Challenged')
  assert.equal(analyzeActivity({ ...clean, failures: 3 }, policy).decision, 'Blocked')
  for (const bad of [{ maxFailures: 0 }, { maxRequests: 1.5 }, { maxPayload: '' }, { alertThreshold: 101 }, { alertThreshold: 80, blockThreshold: 70 }]) assert.throws(() => validatePolicies({ ...defaultPolicies, ...bad }))
})
test('Activity validation rejects invalid IPv4, absent identity, and invalid metrics', () => {
  assert.equal(isIPv4('255.255.255.255'), true)
  for (const ip of ['256.1.1.1', '01.2.3.4', '::1', '1.2.3', 'x.x.x.x']) assert.equal(isIPv4(ip), false)
  for (const bad of [{ identity: '' }, { ip: 'bad' }, { failures: -1 }, { requests: 2.5 }, { payload: '' }]) assert.throws(() => analyzeActivity({ ...clean, ...bad }, defaultPolicies))
})
test('Report filters exclude samples, retain untimed legacy records only without dates, and use inclusive days', () => {
  const state = initialSecurityState()
  state.events.push({ ...analyzeActivity(clean, defaultPolicies), id: 'actual', source: 'Application', timestamp: new Date('2026-10-13T12:00:00').toISOString() })
  const ledger = [{ id: 'legacy', algorithm: 'Caesar', digest: 'abc' }]
  assert.equal(reportRows(state, ledger, '', '', false).length, 2)
  assert.equal(reportRows(state, ledger, '2026-10-13', '2026-10-13', false).length, 1)
  assert.equal(withinDates(new Date('2026-10-13T23:59:59').toISOString(), '2026-10-13', '2026-10-13'), true)
  assert.equal(withinDates(new Date('2026-10-14T00:00:00').toISOString(), '', '2026-10-13'), false)
  assert.equal(withinDates(undefined, '2026-10-13', ''), false)
})
test('CSV escapes commas, quotes, newlines and neutralizes spreadsheet formulas', () => {
  const csv = csvExport([{ type: 'Activity', identity: '=SUM(1,2)', detail: 'one,"two"\nthree' }, { identity: ' \t@malicious' }])
  assert.ok(csv.includes('"\'=SUM(1,2)"'))
  assert.ok(csv.includes('"one,""two""\nthree"'))
  assert.ok(csv.includes('"\' \t@malicious"'))
})
