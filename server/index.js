import { createServer } from 'node:http'
import { createApplication } from './application.js'
const { config, handler } = createApplication()
createServer(handler).listen(Number(process.env.PORT ?? 3001), '127.0.0.1', () => console.log(`API listening on port ${process.env.PORT ?? 3001}. Supabase ${config.ready ? 'configured' : 'configuration required'}.`))
