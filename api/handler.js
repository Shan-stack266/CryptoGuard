import { createApplication } from '../server/application.js'

let handler
export default async function vercelHandler(request, response) {
  try {
    handler ??= createApplication(process.env, { vercel: true }).handler
  } catch {
    response.setHeader('Content-Type', 'application/json; charset=utf-8')
    response.setHeader('Cache-Control', 'no-store')
    response.statusCode = 503
    return response.end(JSON.stringify({ error: 'API configuration is invalid. Check the server environment variables in Vercel.' }))
  }
  // Preserve API paths and log query filters when Vercel rewrites to this function.
  const url = new URL(request.url, 'http://internal')
  const path = request.query?.__cg_path ?? url.searchParams.get('__cg_path')
  if (typeof path === 'string') url.pathname = `/api/${path}`
  url.searchParams.delete('__cg_path')
  request.url = `${url.pathname}${url.search}`
  return handler(request, response)
}
