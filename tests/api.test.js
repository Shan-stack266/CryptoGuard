import test from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { createHash } from 'node:crypto'
import { createHandler } from '../server/api.js'
const userID = '11111111-1111-4111-8111-111111111111'
function fixture(role = 'user') {
  const tables = { cg_profiles: [{ id: userID, email: 'real-user@example.test', role, active: true }], cg_policies: [{ id: 1, max_failures: 5, max_requests: 120, max_payload: 1024, alert_threshold: 50, block_threshold: 75, auto_block: true, emergency: false }], cg_events: [], cg_alerts: [], cg_audit: [], cg_blocked_ips: [], cg_cipher_history: [], cg_account_logs: [], cg_login_counters: [] }
  tables.cg_sessions=[{token_hash:createHash('sha256').update('a'.repeat(64)).digest('hex'),user_id:userID,expires_at:new Date(Date.now()+60000).toISOString()}]
  let attempts = 0
  const store = {
    async anomalyCount(){return 0},
    async count(table,filters={}){return tables[table].filter(row=>Object.entries(filters).every(([key,value])=>row[key]===value)).length},
    async page(spec){const rows=tables[spec.table].filter(row=>Object.entries(spec.filters).every(([key,value])=>row[key]===value));return{rows:rows.slice((spec.page-1)*spec.size,spec.page*spec.size),total:rows.length,page:spec.page,size:spec.size}},
    async list(table, filters = {}, limit = 200) { return tables[table].filter((row) => Object.entries(filters).every(([key,value]) => row[key] === value)).slice(0,limit) },
    async insert(table,row) { const saved = { id: crypto.randomUUID(), timestamp: new Date().toISOString(), reasons: [], controls: [], score: 0, severity: 'Low', decision: 'Allowed', ...row }; tables[table].unshift(saved); return saved },
    async update(table,filters,body) { for (const row of tables[table]) if (Object.entries(filters).every(([key,value]) => row[key] === value)) Object.assign(row,body); return [] },
    async remove(table,filters) { tables[table] = tables[table].filter((row) => !Object.entries(filters).every(([key,value]) => row[key] === value)) },
    async failures(email) { attempts++; const locked_until = attempts >= 5 ? new Date(Date.now()+900000).toISOString() : null; tables.cg_login_counters = [{ email, failures: attempts, locked_until }]; return { failures: attempts, locked_until } },
  }
  const auth = { async verify(token) { return token === 'valid' ? { id: userID, email: 'real-user@example.test' } : null }, async login(email,password) { return password === 'correctpassword' ? { user: { id: userID,email }, session: { access_token: 'valid',refresh_token:'refresh',expires_in:3600 } } : null }, async refresh() { return null }, async logout() {}, async signup() {}, async recover() {}, async password() {} }
  const handler = createHandler({ store,auth,config: { ready: true, origin: 'http://localhost:5173',secure:true,trustProxy:false } })
  async function request(path, body, { cookie=`cg_access=valid; cg_session=${'a'.repeat(64)}`,origin='http://localhost:5173',method=body === undefined ? 'GET' : 'POST' } = {}) {
    const req = Readable.from(body === undefined ? [] : [JSON.stringify(body)])
    req.url=path; req.method=method; req.headers={ cookie,origin,'user-agent':'test-browser','x-forwarded-for':'203.0.113.200' }; req.socket={ remoteAddress:'192.0.2.1' }
    const headers={}; let payload
    const res={ setHeader(name,value) { headers[name]=value }, end(value) { payload=JSON.parse(value) },statusCode:200 }
    await handler(req,res); return { status:res.statusCode,body:payload,headers }
  }
  return { request,tables }
}
test('API requires verified identity and denies forged origin', async () => {
  const app=fixture()
  assert.equal((await app.request('/api/state',undefined,{cookie:'cg_access=forged'})).status,401)
  assert.equal((await app.request('/api/ciphers',{}, {origin:'https://attacker.test'})).status,403)
})
test('Regular user cannot administer policies and gets only their own records', async () => {
  const app=fixture()
  assert.equal((await app.request('/api/policies',{}, {method:'PUT'})).status,403)
  app.tables.cg_events.push({ id:'other',user_id:'someone-else',timestamp:new Date().toISOString() })
  const result=await app.request('/api/state')
  assert.equal(result.status,200); assert.ok(result.body.events.every((event) => event.user_id === userID)); assert.deepEqual(result.body.accounts,[])
})
test('Five failed attempts lock the account and create a security alert', async () => {
  const app=fixture()
  for(let i=0;i<4;i++) assert.equal((await app.request('/api/auth/login',{email:'real-user@example.test',password:'wrongpassword'},{cookie:''})).status,401)
  assert.equal((await app.request('/api/auth/login',{email:'real-user@example.test',password:'wrongpassword'},{cookie:''})).status,423)
  assert.equal((await app.request('/api/auth/login',{email:'real-user@example.test',password:'correctpassword'},{cookie:''})).status,423)
  assert.ok(app.tables.cg_alerts.some((alert) => alert.severity === 'Critical'))
  assert.ok(app.tables.cg_events.every((event) => !('password' in event)))
})
test('Session cookies are HttpOnly/Secure and passwords are not returned', async () => {
  const app=fixture()
  const result=await app.request('/api/auth/login',{email:'real-user@example.test',password:'correctpassword'},{cookie:''})
  assert.equal(result.status,200)
  assert.ok(result.headers['Set-Cookie'].every((cookie) => cookie.includes('HttpOnly') && cookie.includes('Secure') && cookie.includes('SameSite=Lax')))
  assert.ok(!JSON.stringify(result.body).includes('password'))
})
test('Restrictions enforce actual API access while administrators can release emergency mode', async () => {
  const normal=fixture(); normal.tables.cg_profiles[0].active=false
  assert.equal((await normal.request('/api/state')).status,403)
  const admin=fixture('admin'); admin.tables.cg_policies[0].emergency=true
  assert.equal((await admin.request('/api/state')).status,200)
  assert.equal((await admin.request('/api/accounts',{id:userID,role:'user',active:true},{method:'PATCH'})).status,409)
})
test('Cipher transactions validate digest and bind ownership to the server identity', async () => {
  const app=fixture()
  assert.equal((await app.request('/api/ciphers',{algorithm:'Caesar',operation:'Encrypt',digest:'short'})).status,400)
  const result=await app.request('/api/ciphers',{algorithm:'Caesar',operation:'Encrypt',digest:'a'.repeat(64),user_id:'attacker'})
  assert.equal(result.status,201); assert.equal(result.body.user_id,userID)
  assert.ok(app.tables.cg_events.every((event) => event.ip === '192.0.2.1'))
})
test('Logout revokes the application session and prevents cookie replay',async()=>{
 const app=fixture()
 assert.equal((await app.request('/api/auth/logout',{})).status,200)
 assert.equal((await app.request('/api/state')).status,401)
})
test('Profile edits cannot change roles and account logs remain administrator-only',async()=>{
 const app=fixture()
 assert.equal((await app.request('/api/profile',{role:'admin',display_name:'Name'},{method:'PATCH'})).status,400)
 assert.equal((await app.request('/api/profile',{display_name:'Personal name'},{method:'PATCH'})).status,200)
 assert.equal(app.tables.cg_profiles[0].display_name,'Personal name')
 assert.equal((await app.request('/api/logs?kind=account')).status,403)
 assert.deepEqual((await app.request('/api/state')).body.accountLogs,[])
})
test('Log pagination and ownership are applied by the server',async()=>{
 const app=fixture()
 app.tables.cg_cipher_history.push({id:'mine',user_id:userID},{id:'other',user_id:'someone-else'})
 const result=await app.request('/api/logs?kind=cipher&page=1&size=1')
 assert.equal(result.status,200);assert.equal(result.body.total,1);assert.equal(result.body.rows[0].id,'mine')
 assert.equal((await app.request('/api/logs?kind=activity&size=1000')).status,400)
})
test('Password change revokes old application sessions and renews the current session',async()=>{
 const app=fixture()
 const result=await app.request('/api/auth/password',{password:'newsecurepassword'})
 assert.equal(result.status,200)
 assert.ok(result.headers['Set-Cookie'].some(cookie=>cookie.startsWith('cg_session=')))
 assert.equal((await app.request('/api/state')).status,401)
})
