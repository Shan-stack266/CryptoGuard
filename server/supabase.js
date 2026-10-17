import { createClient } from '@supabase/supabase-js'

export function createServices(config) {
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  const db = createClient(config.url, config.serviceKey, options)
  const newAuth = () => createClient(config.url, config.anonKey, options)
  const check = ({ data, error }) => { if (error) throw new Error('Database operation failed. Check the schema and server configuration.'); return data }
  const store = {
    async page(spec) {
      let query=db.from(spec.table).select('*',{count:'exact'})
      for(const [key,value] of Object.entries(spec.filters))query=query.eq(key,value)
      if(spec.start)query=query.gte('timestamp',spec.start)
      if(spec.end)query=query.lte('timestamp',spec.end)
      if(spec.kind==='security')query=query.in('decision',['Failed','Blocked','Challenged'])
      if(spec.kind==='model')query=query.not('model','eq','{}')
      if(spec.search){
        const search=spec.search.replace(/[\\%_(),.*"']/g,'')
        if(search){const fields=spec.table==='cg_account_logs'?['operation']:spec.table==='cg_cipher_history'?['algorithm','operation']:spec.table==='cg_alerts'?['identity','title']:['identity','operation'];query=query.or(fields.map(field=>`${field}.ilike.*${search}*`).join(','))}
      }
      const {data,error,count}=await query.order('timestamp',{ascending:false}).range((spec.page-1)*spec.size,spec.page*spec.size-1)
      if(error)throw new Error('Log query failed. Apply ias-master-migration.sql and check the database.')
      return {rows:data,total:count,page:spec.page,size:spec.size}
    },
    async count(table,filters={},since=null,comparison=null) {
      let query=db.from(table).select('*',{count:'exact',head:true})
      for(const [key,value] of Object.entries(filters))query=query.eq(key,value)
      if(since)query=query.gte('timestamp',since)
      if(comparison)query=query[comparison.op](comparison.field,comparison.value)
      const {count,error}=await query
      if(error)throw new Error('Statistics query failed.')
      return count
    },
    async anomalyCount(filters={},since=null){
      let query=db.from('cg_events').select('*',{count:'exact',head:true}).or('model->>anomalous.eq.true,model->review->>anomalous.eq.true')
      for(const [key,value]of Object.entries(filters))query=query.eq(key,value)
      if(since)query=query.gte('timestamp',since)
      const {count,error}=await query;if(error)throw new Error('Anomaly count query failed.');return count
    },
    async list(table, filters = {}, limit = 200, order = 'timestamp') {
      let query = db.from(table).select('*')
      for (const [key, value] of Object.entries(filters)) query = query.eq(key, value)
      if (order) query = query.order(order, { ascending: false })
      return check(await query.limit(limit))
    },
    async insert(table, row) { return check(await db.from(table).insert(row).select().single()) },
    async update(table, filters, row) { let query = db.from(table).update(row); for (const [key, value] of Object.entries(filters)) query = query.eq(key, value); return check(await query.select()) },
    async remove(table, filters) { let query = db.from(table).delete(); for (const [key, value] of Object.entries(filters)) query = query.eq(key, value); check(await query) },
    async failures(email) { return check(await db.rpc('cg_login_failure', { p_email: email })) },
  }
  const auth = {
    async login(email, password) { const result = await newAuth().auth.signInWithPassword({ email, password }); return result.error ? null : result.data },
    async verify(token) { const result = await newAuth().auth.getUser(token); return result.error ? null : result.data.user },
    async refresh(refresh_token) { const result = await newAuth().auth.refreshSession({ refresh_token }); return result.error ? null : result.data.session },
    async signup(email, password, details) {
      const result = await newAuth().auth.signUp({ email, password, options: { emailRedirectTo: config.origin, data: { full_name: details.full_name, username: details.username } } })
      if (result.error) throw Object.assign(new Error('Registration failed. Check whether the email or username is already used and try again.'), { status: result.error.status === 429 ? 429 : 400 })
      return result.data
    },
    async recover(email) { const result = await newAuth().auth.resetPasswordForEmail(email, { redirectTo: config.origin }); if (result.error) throw new Error('Recovery email could not be requested. Try again later.') },
    async password(token, password) {
      const response = await fetch(`${config.url}/auth/v1/user`, { method: 'PUT', headers: { apikey: config.anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      if (!response.ok) throw new Error('Password update failed. Request a new recovery link and try again.')
    },
    async logout(token) {
      const response = await fetch(`${config.url}/auth/v1/logout?scope=local`, { method: 'POST', headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` } })
      if (!response.ok && response.status !== 401) throw new Error('Session revocation failed. Try logging out again.')
    },
  }
  return { store, auth }
}
