export async function api(path, body, method = body === undefined ? 'GET' : 'POST') {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  let result
  try { result = await response.json() } catch { throw new Error('API unavailable. Start the server and check Supabase configuration.') }
  if (!response.ok) { const error = new Error(result.error ?? 'Request failed.'); error.status = response.status; throw error }
  return result
}
