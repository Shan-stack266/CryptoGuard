export const defaultPolicies = { maxFailures: 5, maxRequests: 120, maxPayload: 1024, alertThreshold: 50, blockThreshold: 75, autoBlock: true, emergency: false }
export const isIPv4 = (value) => /^(\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split('.').every((part) => Number(part) <= 255 && String(Number(part)) === part)

function integer(value, min, max, label) {
  if (value === '' || !Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max) throw new Error(`${label} must be a whole number from ${min} to ${max}.`)
  return Number(value)
}

export function validatePolicies(input) {
  const policies = {
    ...input,
    maxFailures: integer(input.maxFailures, 1, 5, 'Failed-login limit'),
    maxRequests: integer(input.maxRequests, 1, 100000, 'Request limit'),
    maxPayload: integer(input.maxPayload, 1, 1000000, 'Payload limit'),
    alertThreshold: integer(input.alertThreshold, 1, 100, 'Alert threshold'),
    blockThreshold: integer(input.blockThreshold, 1, 100, 'Block threshold'),
  }
  if (policies.blockThreshold < policies.alertThreshold) throw new Error('Block threshold must be at least the alert threshold.')
  return policies
}

export function analyzeActivity(input, policies, blockedIPs = []) {
  const identity = input.identity.trim(), ip = input.ip.trim()
  if (!identity || identity.length > 100) throw new Error('Enter an identity of 1–100 characters.')
  if (!isIPv4(ip)) throw new Error('Enter a valid IPv4 address, such as 192.0.2.10.')
  const failures = integer(input.failures, 0, 10000, 'Failed logins')
  const requests = integer(input.requests, 0, 1000000, 'Requests per minute')
  const payload = integer(input.payload, 0, 10000000, 'Payload size')
  const reasons = []
  let score = 0
  if (failures > 0) { const points = Math.min(50, failures * 10); score += points; reasons.push({ text: `${failures} failed logins`, points }) }
  if (requests > policies.maxRequests) { score += 25; reasons.push({ text: `Request rate exceeds ${policies.maxRequests}/minute`, points: 25 }) }
  if (payload > policies.maxPayload) { score += 30; reasons.push({ text: `Payload exceeds ${policies.maxPayload} KB`, points: 30 }) }
  if (input.unknownDevice) { score += 20; reasons.push({ text: 'Unrecognized device', points: 20 }) }
  score = Math.min(score, 100)
  const listed = blockedIPs.some((entry) => entry.ip === ip)
  const failureLimit = failures >= policies.maxFailures
  const shouldBlock = policies.emergency || listed || failureLimit || (policies.autoBlock && score >= policies.blockThreshold)
  const severity = score >= 75 ? 'Critical' : score >= 50 ? 'High' : score >= 25 ? 'Medium' : 'Low'
  const decision = shouldBlock ? 'Blocked' : score >= policies.alertThreshold ? 'Challenged' : 'Allowed'
  const controls = [policies.emergency && 'Emergency lab lockout', listed && 'IP is on the lab block list', failureLimit && 'Failed-login limit reached', policies.autoBlock && score >= policies.blockThreshold && 'Automatic risk blocking'].filter(Boolean)
  return { identity, ip, failures, requests, payload, unknownDevice: Boolean(input.unknownDevice), score, severity, decision, reasons, controls, createAlert: shouldBlock || score >= policies.alertThreshold }
}

export function initialSecurityState() {
  return {
    policies: { ...defaultPolicies }, blockedIPs: [], events: [], alerts: [], audit: [], accountLogs: [],
  }
}

export function withinDates(timestamp, start, end) {
  if (!start && !end) return true
  if (!timestamp) return false
  const value = new Date(timestamp).getTime()
  return Number.isFinite(value) && (!start || value >= new Date(`${start}T00:00:00`).getTime()) && (!end || value <= new Date(`${end}T23:59:59.999`).getTime())
}

export function csvExport(rows) {
  const columns = ['type', 'timestamp', 'source', 'identity', 'ip', 'algorithm', 'operation', 'severity', 'score', 'status', 'detail']
  const cell = (value) => {
    let text = String(value ?? '')
    // Prevent spreadsheet formula execution, including leading whitespace.
    if (/^\s*[=+@-]/.test(text)) text = `'${text}`
    return `"${text.replaceAll('"', '""')}"`
  }
  return [columns.join(','), ...rows.map((row) => columns.map((column) => cell(row[column])).join(','))].join('\r\n')
}

export function reportRows(state, ledger, start = '', end = '', includeExamples = true) {
  return [
    ...state.events.map((event) => ({ ...event, type: 'Activity', status: event.decision, detail: [event.operation, ...(event.reasons ?? []).map((r) => r.text), ...(event.controls ?? [])].filter(Boolean).join('; ') })),
    ...state.alerts.map((alert) => ({ ...alert, type: 'Alert', detail: [alert.title, alert.note].filter(Boolean).join('; ') })),
    ...state.audit.map((entry) => ({ ...entry, type: 'Audit', source: 'Application', detail: entry.detail })),
    ...(state.accountLogs ?? []).map((entry) => ({ ...entry, type: 'Account', source: 'Application', status: 'Recorded', detail: JSON.stringify(entry.detail) })),
    ...ledger.map((entry) => ({ ...entry, type: 'Cipher', source: 'Application', detail: entry.digest })),
  ].filter((row) => withinDates(row.timestamp, start, end) && (includeExamples || row.source !== 'Example'))
    .sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''))
}
