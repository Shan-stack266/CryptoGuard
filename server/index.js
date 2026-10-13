import { createServer } from 'node:http'
import { createServices } from './supabase.js'
import { createHandler } from './api.js'
const config = { url: process.env.SUPABASE_URL, anonKey: process.env.SUPABASE_ANON_KEY, serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY, origin: process.env.APP_ORIGIN ?? 'http://localhost:5173', secure: process.env.NODE_ENV === 'production', trustProxy: process.env.TRUST_PROXY === 'true' }
config.ready = Boolean(config.url && config.anonKey && config.serviceKey)
config.additionalOrigins = (process.env.APP_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean)
const services = config.ready ? createServices(config) : {}
createServer(createHandler({ ...services, config })).listen(Number(process.env.PORT ?? 3001), '127.0.0.1', () => console.log(`API listening on port ${process.env.PORT ?? 3001}. Supabase ${config.ready ? 'configured' : 'configuration required'}.`))
