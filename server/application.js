import { createServices } from './supabase.js'
import { createHandler } from './api.js'

export function createApplication(env = process.env, { vercel = false } = {}) {
  const deployedHost = env.VERCEL_PROJECT_PRODUCTION_URL ?? env.VERCEL_URL
  const config = {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    origin: env.APP_ORIGIN ?? (vercel && deployedHost ? `https://${deployedHost}` : 'http://localhost:5173'),
    additionalOrigins: (env.APP_ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean),
    secure: vercel || env.NODE_ENV === 'production',
    trustProxy: vercel || env.TRUST_PROXY === 'true',
  }
  config.ready = Boolean(config.url && config.anonKey && config.serviceKey)
  const services = config.ready ? createServices(config) : {}
  return { config, handler: createHandler({ ...services, config }) }
}
