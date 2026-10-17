import { createHash, randomBytes } from 'node:crypto'
import { logQuery } from './logQuery.js'
import { allowedOrigins } from './origins.js'
import { analyzeActivity, validatePolicies } from '../src/utils/securityLab.js'
import { detectAnomaly } from './anomaly.js'

export const policyFromDB = (row) => ({ maxFailures: row.max_failures, maxRequests: row.max_requests, maxPayload: row.max_payload, alertThreshold: row.alert_threshold, blockThreshold: row.block_threshold, autoBlock: row.auto_block, emergency: row.emergency })
const cookieMap = (request) => Object.fromEntries((request.headers.cookie ?? '').split(';').map((value) => value.trim().split('=')).filter((parts) => parts.length === 2))
const fail = (status, message) => Object.assign(new Error(message), { status })
const emailValue = (value) => { const email = String(value ?? '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw fail(400, 'Enter a valid email.'); return email }
const passwordValue = (value) => { if (typeof value !== 'string' || value.length < 8 || value.length > 256 || !value.trim()) throw fail(400, 'Password must contain 8–256 characters.'); return value }
const idValue = (value) => { if (!/^[0-9a-f-]{36}$/i.test(value ?? '')) throw fail(400, 'Invalid record ID.'); return value }
function setCookies(response, session, secure) {
  const suffix = `; HttpOnly; SameSite=Lax; Path=/api${secure ? '; Secure' : ''}`
  response.setHeader('Set-Cookie', [
    `cg_access=${session?.access_token ?? ''}; Max-Age=${session ? session.expires_in ?? 3600 : 0}${suffix}`,
    `cg_refresh=${session?.refresh_token ?? ''}; Max-Age=${session ? 604800 : 0}${suffix}`,
    ...(!session || session.server_token ? [`cg_session=${session?.server_token ?? ''}; Max-Age=${session ? 604800 : 0}${suffix}`] : []),
  ])
}

export function createHandler({ store, auth, config }) {
  const origins = allowedOrigins(config)
  const rates = new Map()
  const limited = (key, max) => {
    const now = Date.now(), current = rates.get(key)
    const entry = current && current.expires > now ? current : { count: 0, expires: now + 60000 }
    rates.set(key, entry); entry.count++
    if (rates.size > 10000) for (const [name, value] of rates) if (value.expires < now) rates.delete(name)
    if (entry.count > max) throw fail(429, 'Too many requests. Wait a minute and try again.')
  }
  const audit = (user, operation, detail) => store.insert('cg_audit', { user_id: user.id, operation, detail: String(detail).slice(0, 2000) })
  async function profile(user) { const rows = await store.list('cg_profiles', { id: user.id }, 1, null); return rows[0] }
  async function policies() { return policyFromDB((await store.list('cg_policies', { id: 1 }, 1, null))[0]) }
  async function newSession(user) {
    const server_token=randomBytes(32).toString('hex')
    await store.insert('cg_sessions',{token_hash:createHash('sha256').update(server_token).digest('hex'),user_id:user.id,expires_at:new Date(Date.now()+604800000).toISOString()})
    return server_token
  }
  async function record(user, ip, operation, fields = {}) {
    const event = await store.insert('cg_events', { user_id: user?.id ?? null, identity: user?.email ?? fields.identity ?? 'Unknown', ip, operation, source: 'Application', ...fields })
    if (event.decision === 'Blocked' || event.decision === 'Challenged' || event.score >= 50) await store.insert('cg_alerts', { event_id: event.id, user_id: user?.id ?? null, identity: event.identity, ip, title: `${operation}: ${[...(event.controls ?? []), ...(event.reasons ?? []).map((r) => r.text)].join('; ')}`, score: event.score, severity: event.severity, source: 'Application' })
    return event
  }
  return async (request, response) => {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    const send = (status, value) => { response.statusCode = status; response.end(JSON.stringify(value)) }
    try {
      const url = new URL(request.url, 'http://localhost'), path=url.pathname
      if (path === '/api/health') return send(config.ready ? 200 : 503, { configured: config.ready })
      if (!config.ready) throw fail(503, 'Supabase is not configured. Set the server environment and run database/supabase-schema.sql.')
      const ip = config.trustProxy ? String(request.headers['x-forwarded-for'] ?? request.socket.remoteAddress).split(',')[0].trim() : request.socket.remoteAddress.replace(/^::ffff:/, '')
      if (request.method !== 'GET' && !origins.has(request.headers.origin)) throw fail(403, 'Request origin is not allowed.')
      let text = ''
      if (request.body !== undefined) {
        text = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
        if (Buffer.byteLength(text) > 65536) throw fail(413, 'Request is too large.')
      } else {
        for await (const chunk of request) { text += chunk; if (Buffer.byteLength(text) > 65536) throw fail(413, 'Request is too large.') }
      }
      let body = {}
      if (text) { try { body = JSON.parse(text) } catch { throw fail(400, 'Invalid JSON.') } }
      const cookies = cookieMap(request)
      let token = cookies.cg_access, user
      if (path.startsWith('/api/auth/') && ['login','signup','recover','recovery'].some((part) => path.endsWith(`/${part}`))) {
        if (request.method !== 'POST') throw fail(405, 'Method not allowed.')
        limited(`auth:${ip}`, 15)
        if (path.endsWith('/signup')) {
          const email = emailValue(body.email), password = passwordValue(body.password)
          const full_name = typeof body.full_name === 'string' ? body.full_name.trim() : ''
          const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
          if (full_name.length < 2 || full_name.length > 100 || /[\u0000-\u001f\u007f]/.test(full_name)) throw fail(400, 'Enter a full name of 2-100 characters.')
          if (!/^[a-z0-9_]{3,30}$/.test(username)) throw fail(400, 'Username must contain 3-30 letters, numbers, or underscores.')
          if (body.confirm_password !== password) throw fail(400, 'Passwords do not match.')
          let existing
          try { existing = await store.list('cg_profiles', { username }, 1, null) }
          catch { throw fail(503, 'Registration setup is incomplete. Apply database/signup-profile-migration.sql.') }
          if (existing.length) throw fail(409, 'Username is not available. Choose another one.')
          let signup
          try { signup = await auth.signup(email, password, { full_name, username }) }
          catch (failure) {
            const conflict = await store.list('cg_profiles', { username }, 1, null).catch(() => [])
            if (conflict.length) throw fail(409, 'Username is not available. Choose another one.')
            throw failure
          }
          return send(201, { message: signup?.session ? 'Account created. You can log in now.' : 'Account submitted. Confirm your email if required, then log in.' })
        }
        if (path.endsWith('/recover')) { await auth.recover(emailValue(body.email)); return send(200, { message: 'If the account exists, a recovery email will be sent.' }) }
        if (path.endsWith('/recovery')) {
          if (![body.access_token,body.refresh_token].every((value) => typeof value === 'string' && value.length <= 8192 && /^[A-Za-z0-9._-]+$/.test(value))) throw fail(400, 'Invalid recovery link.')
          user = await auth.verify(body.access_token)
          if (!user) throw fail(401, 'Recovery link expired or invalid.')
          setCookies(response, {...body,server_token:await newSession(user)}, config.secure)
          return send(200, { message: 'Recovery session verified.' })
        }
        const email = emailValue(body.email), password = passwordValue(body.password)
        const counter = (await store.list('cg_login_counters', { email }, 1, null))[0]
        if (counter?.locked_until && Date.parse(counter.locked_until) > Date.now()) throw fail(423, 'Account access is temporarily locked. Try again after 15 minutes or contact an administrator.')
        const result = await auth.login(email, password)
        if (!result) {
          const attempt = await store.failures(email)
          const affected=(await store.list('cg_profiles',{email},1,null))[0]
          await record(affected?{id:affected.id,email}:null, ip, 'Login failed', { identity: email, failures: attempt.failures, score: Math.min(100, attempt.failures * 20), severity: attempt.locked_until ? 'Critical' : 'Medium', decision: attempt.locked_until ? 'Blocked' : 'Failed', controls: attempt.locked_until ? ['Failed-attempt account lock'] : [],user_agent:String(request.headers['user-agent']??'').slice(0,500),http_status:attempt.locked_until?423:401 })
          throw fail(attempt.locked_until ? 423 : 401, attempt.locked_until ? 'Account access locked for 15 minutes after repeated failed attempts.' : 'Email or password is incorrect.')
        }
        user = result.user
        const account = await profile(user), policy = await policies()
        const blocked = (await store.list('cg_blocked_ips', { ip }, 1, null)).length > 0
        if (!account?.active || (account.locked_until && Date.parse(account.locked_until) > Date.now()) || (account.role !== 'admin' && (policy.emergency || blocked))) {
          await record(user, ip, 'Access denied', { score: 100, severity: 'Critical', decision: 'Blocked', controls: ['Account or access policy restriction'] })
          throw fail(403, 'Account or access policy restricts this login. Contact an administrator.')
        }
        await store.remove('cg_login_counters', { email })
        await record(user, ip, 'Login', { decision: 'Allowed',user_agent:String(request.headers['user-agent']??'').slice(0,500),http_status:200 })
        setCookies(response, {...result.session,server_token:await newSession(user)}, config.secure)
        return send(200, { user: account })
      }
      user = token ? await auth.verify(token) : null
      if (!user && cookies.cg_refresh) {
        const session = await auth.refresh(cookies.cg_refresh)
        if (session) { token = session.access_token; user = await auth.verify(token); setCookies(response, session, config.secure) }
      }
      if (!user) {
        setCookies(response, null, config.secure)
        if (path !== '/api/auth/session') {
          limited(`denied:${ip}`, 20)
          await record(null, ip, 'Access denied', { score: 80, severity: 'Critical', decision: 'Blocked', controls: [`Authentication required for ${path}`] })
        }
        throw fail(401, 'Log in to continue.')
      }
      const sessionHash=createHash('sha256').update(cookies.cg_session??'').digest('hex')
      const [appSessions, account] = await Promise.all([store.list('cg_sessions',{token_hash:sessionHash,user_id:user.id},1,null), profile(user)])
      const appSession=appSessions[0]
      if(!appSession||appSession.revoked_at||Date.parse(appSession.expires_at)<=Date.now()){setCookies(response,null,config.secure);throw fail(401,'Application session expired. Log in again.')}
      if (path === '/api/auth/logout' && request.method === 'POST') {
        try { await store.update('cg_sessions',{token_hash:sessionHash},{revoked_at:new Date().toISOString()});await record(user, ip, 'Logout'); await auth.logout(token) }
        finally { setCookies(response, null, config.secure) }
        return send(200, { ok: true })
      }
      if (!account?.active) throw fail(403, 'This account is deactivated.')
      if (path === '/api/auth/password' && request.method === 'POST') {
        await auth.password(token, passwordValue(body.password))
        try {
          await store.update('cg_sessions',{user_id:user.id},{revoked_at:new Date().toISOString()})
          setCookies(response,{access_token:token,refresh_token:cookies.cg_refresh,server_token:await newSession(user)},config.secure)
        } catch {setCookies(response,null,config.secure);throw fail(503,'Password changed, but the application session could not be renewed. Log in again.')}
        return send(200, { message: 'Password updated. Other application sessions were revoked.' })
      }
      if (account.locked_until && Date.parse(account.locked_until) > Date.now()) throw fail(423, 'Account temporarily locked. Contact an administrator.')
      const isSession = path === '/api/auth/session' && request.method === 'GET'
      const [policy, blockedIPsForRequest, baseline] = await Promise.all([
        policies(),
        account.role !== 'admin' ? store.list('cg_blocked_ips', { ip }, 1, null) : [],
        isSession ? [] : store.list('cg_events', { user_id: user.id }, 200),
      ])
      if (account.role !== 'admin' && (policy.emergency || blockedIPsForRequest.length)) {
        await record(user, ip, 'Access denied', { score: 100, severity: 'Critical', decision: 'Blocked', controls: ['Active access restriction'] })
        throw fail(403, 'Access restricted by security policy.')
      }
      if (path === '/api/auth/session' && request.method === 'GET') return send(200, { user: account })
      if(path==='/api/profile'&&request.method==='PATCH'){
        if(Object.keys(body).some(key=>key!=='display_name')||typeof body.display_name!=='string'||body.display_name.trim().length>100)throw fail(400,'Only a display name of at most 100 characters can be updated.')
        const updated=await store.update('cg_profiles',{id:user.id},{display_name:body.display_name.trim()})
        await store.insert('cg_account_logs',{actor_id:user.id,target_id:user.id,operation:'Profile updated',detail:{field:'display_name',source:'verified API'}})
        await record(user,ip,'Profile updated',{http_status:200})
        return send(200,{user:updated[0]??await profile(user)})
      }
      limited(`user:${user.id}`, 240)
      const admin = account.role === 'admin'
      const adminRoutes = ['/api/policies','/api/blocks','/api/alerts','/api/accounts']
      if (!admin && (adminRoutes.some((route) => path.startsWith(route)) || path === '/api/security/analyze' || (path==='/api/logs'&&['account','security','model'].includes(url.searchParams.get('kind'))))) {
        await record(user, ip, 'Access denied', { score: 80, severity: 'Critical', decision: 'Blocked', controls: ['Administrator role required'] })
        throw fail(403, 'Administrator role required.')
      }
      if (admin && path === '/api/ciphers') {
        await record(user, ip, 'Access denied', { score: 80, severity: 'High', decision: 'Blocked', controls: ['Cryptography is reserved for regular user accounts'], http_status: 403 })
        throw fail(403, 'Cryptography is available to regular users. Administrators monitor security only.')
      }
      // Measure authenticated activity on the server. Reject anomalous requests
      // before performing their operation when automatic prevention is enabled.
      const requests = baseline.filter((event) => Date.parse(event.timestamp) > Date.now() - 60000&&/^(GET|POST|PUT|PATCH|DELETE) /.test(event.operation)).length + 1
      const deviceHash = createHash('sha256').update(String(request.headers['user-agent'] ?? '')).digest('hex')
      const measured = { operation: `${request.method} ${path}`, identity: user.id, ip: ip.includes(':') ? '127.0.0.1' : ip, failures: 0, requests, payload: Buffer.byteLength(text) / 1024, unknownDevice: baseline.some((event) => event.device_hash) && !baseline.some((event) => event.device_hash === deviceHash) }
      const risk = analyzeActivity({ ...measured, payload: Math.ceil(measured.payload) }, { ...policy, emergency: admin ? false : policy.emergency }, [])
      const model = detectAnomaly(measured, baseline)
      if (model.anomalous) { risk.score = Math.max(risk.score, 75); risk.severity = 'Critical'; risk.reasons.push({ text: 'kNN model detected activity outside the learned baseline', points: 75 }); risk.decision = policy.autoBlock ? 'Blocked' : 'Challenged' }
      const fields = { failures: 0, requests, payload: measured.payload, device_hash: deviceHash, score: risk.score, severity: risk.severity, decision: risk.decision, reasons: risk.reasons, controls: risk.controls, model,user_agent:String(request.headers['user-agent']??'').slice(0,500) }
      await record(user, ip, `${request.method} ${path}`, fields)
      if (risk.decision === 'Blocked' && !(admin && path === '/api/policies')) throw fail(403, 'Activity blocked by risk controls. Contact an administrator.')
      if(path==='/api/logs'&&request.method==='GET')return send(200,await store.page(logQuery(url.searchParams,user,admin)))
      if(path==='/api/summary'&&request.method==='GET'){
        const own=admin?{}:{user_id:user.id},day=new Date(Date.now()-86400000).toISOString()
        const [users,active,failures,denied,open,ack,restrictions,locked,flagged,anomalies]=await Promise.all([
          admin?store.count('cg_profiles'):1,admin?store.count('cg_profiles',{active:true}):1,
          store.count('cg_events',{...own,operation:'Login failed'},day),store.count('cg_events',{...own,operation:'Access denied'},day),
          store.count('cg_alerts',{...own,status:'Open'}),store.count('cg_alerts',{...own,status:'Acknowledged'}),admin?store.count('cg_blocked_ips'):0,
          admin?store.count('cg_profiles',{},null,{field:'locked_until',op:'gt',value:new Date().toISOString()}):0,
          store.count('cg_events',own,day,{field:'score',op:'gte',value:50}),store.anomalyCount(own,day)])
        return send(200,{users,active,failures,denied,open,ack,restrictions:restrictions+locked+(policy.emergency?1:0),flagged,anomalies,window:'Last 24 hours for activity counts; account/alert/restriction counts are current totals.'})
      }
      if (path === '/api/state' && request.method === 'GET') {
        const own = admin ? {} : { user_id: user.id }
        const [events, alerts, auditRows, blockedIPs, ledger, accounts, accountLogs] = await Promise.all([
          store.list('cg_events', own), store.list('cg_alerts', own, 100), store.list('cg_audit', own, 100),
          admin ? store.list('cg_blocked_ips', {}, 200) : [], store.list('cg_cipher_history', own, 200),
          admin ? store.list('cg_profiles', {}, 200, 'created_at') : [], admin?store.list('cg_account_logs',{},100):[],
        ])
        return send(200, { policies: policy, events, alerts, audit: auditRows, blockedIPs, ledger, accounts, accountLogs, model })
      }
      if (path === '/api/ciphers' && request.method === 'POST') {
        if (!['Playfair','Caesar','Bifid','Vigenère','AES-256-GCM'].includes(body.algorithm) || !['Encrypt','Decrypt'].includes(body.operation) || !/^[0-9a-f]{64}$/.test(body.digest ?? '')) throw fail(400, 'Invalid cipher history record.')
        const history=await store.insert('cg_cipher_history', { user_id: user.id, algorithm: body.algorithm, operation: body.operation, digest: body.digest, status: 'Processed' })
        await record(user,ip,`${body.operation} ${body.algorithm}`,{user_agent:String(request.headers['user-agent']??'').slice(0,500),http_status:201})
        return send(201,history)
      }
      if (path === '/api/security/analyze' && request.method === 'POST') {
        const event = (await store.list('cg_events', { id: idValue(body.id) }, 1, null))[0]
        if (!event) throw fail(404, 'Activity record not found.')
        const training = await store.list('cg_events', { user_id: event.user_id }, 200)
        const result = detectAnomaly(event, training.filter((entry) => entry.id !== event.id && Date.parse(entry.timestamp) < Date.parse(event.timestamp)))
        await store.update('cg_events',{id:event.id},{model:{...event.model,review:{...result,reviewed_at:new Date().toISOString(),reviewed_by:user.id}}})
        if(result.anomalous&&!(await store.list('cg_alerts',{event_id:event.id},1)).length)await store.insert('cg_alerts',{event_id:event.id,user_id:event.user_id,identity:event.identity,ip:event.ip,title:'Model review detected an unusual activity pattern',score:75,severity:'High',source:'Application'})
        await audit(user, 'Model review', `${event.id}: ${JSON.stringify(result)}`)
        return send(200, { ...event, model: result })
      }
      if (path === '/api/policies' && request.method === 'PUT') {
        const draft = validatePolicies(body)
        if (draft.maxFailures > 5) throw fail(400, 'The guideline permits no more than five failed attempts.')
        await store.update('cg_policies', { id: 1 }, { max_failures: draft.maxFailures, max_requests: draft.maxRequests, max_payload: draft.maxPayload, alert_threshold: draft.alertThreshold, block_threshold: draft.blockThreshold, auto_block: Boolean(draft.autoBlock), emergency: Boolean(draft.emergency), updated_at: new Date().toISOString() })
        await audit(user, 'Policy update', JSON.stringify(draft)); return send(200, { ok: true })
      }
      if (path === '/api/blocks' && request.method === 'POST') {
        if (body.ip === ip) throw fail(400, 'You cannot block your current administrator address.')
        const validated = analyzeActivity({ identity: user.email, ip: body.ip, failures: 0, requests: 0, payload: 0 }, policy)
        if (!body.reason?.trim() || body.reason.length > 200) throw fail(400, 'Enter a reason of 1–200 characters.')
        await store.insert('cg_blocked_ips', { ip: validated.ip, reason: body.reason.trim(), created_by: user.id }); await audit(user, 'Block IP', validated.ip); return send(201, { ok: true })
      }
      if (path === '/api/blocks' && request.method === 'DELETE') { await store.remove('cg_blocked_ips', { ip: body.ip }); await audit(user, 'Unblock IP', body.ip); return send(200, { ok: true }) }
      if (path === '/api/alerts' && request.method === 'PATCH') {
        if (!['Open','Acknowledged','Resolved'].includes(body.status) || typeof body.note !== 'string' || body.note.length > 1000) throw fail(400, 'Invalid alert update.')
        await store.update('cg_alerts', { id: idValue(body.id) }, { status: body.status, note: body.note, updated_at: new Date().toISOString() }); await audit(user, `Alert ${body.status}`, body.id); return send(200, { ok: true })
      }
      if (path === '/api/accounts' && request.method === 'PATCH') {
        const id = idValue(body.id)
        if (!['user','admin'].includes(body.role) || typeof body.active !== 'boolean') throw fail(400, 'Invalid account update.')
        if (id === user.id && (!body.active || body.role !== 'admin')) throw fail(409, 'You cannot deactivate or demote your own administrator account.')
        const before=(await store.list('cg_profiles',{id},1,null))[0]
        if(!before)throw fail(404,'Account not found.')
        const oldRole=before.role,oldActive=before.active
        await store.update('cg_profiles', { id }, { role: body.role, active: body.active, ...(body.unlock ? { locked_until: null } : {}) })
        if(oldRole!==body.role||oldActive!==body.active)await record({id,email:before.email},ip,'Account access changed',{score:50,severity:'High',decision:'Allowed',controls:[`Account privileges changed by ${user.email}`]})
        if (body.unlock) { const target = (await store.list('cg_profiles', { id }, 1, null))[0]; if (target) await store.remove('cg_login_counters', { email: target.email }) }
        await store.insert('cg_account_logs', { actor_id: user.id, target_id: id, operation: 'Administrator account update', detail: { role: body.role, active: body.active, unlock: Boolean(body.unlock) } }); return send(200, { ok: true })
      }
      if (path === '/api/audit' && request.method === 'POST') { if (!['Snapshot SHA-256','Report export'].includes(body.operation) || typeof body.detail !== 'string') throw fail(400, 'Invalid audit action.'); await audit(user, body.operation, body.detail); return send(201, { ok: true }) }
      throw fail(404, 'API route not found.')
    } catch (error) { const validation = /^(Enter |.*must be|Block threshold)/.test(error.message); send(error.status ?? (validation ? 400 : 500), { error: error.status || validation ? error.message : 'Operation failed. Check the database schema, connection, and server configuration.' }) }
  }
}
