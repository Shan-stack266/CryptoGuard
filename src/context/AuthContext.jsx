/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { api } from '../utils/api.js'
const AuthContext = createContext(null)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true), [error, setError] = useState('')
  const [recovery, setRecovery] = useState(false)
  const restoring = useRef(null)
  useEffect(() => {
    let live = true
    async function readSession() {
      const params = new URLSearchParams(window.location.hash.slice(1))
      if (params.get('type') === 'recovery' && params.get('access_token')) {
        const tokens = { access_token: params.get('access_token'), refresh_token: params.get('refresh_token'), expires_in: Number(params.get('expires_in') ?? 3600) }
        history.replaceState(null, '', location.pathname + location.search)
        await api('/auth/recovery', tokens)
        return { recovery: true }
      }
      if (params.has('access_token')) history.replaceState(null, '', location.pathname + location.search)
      return api('/auth/session')
    }
    async function restore() {
      try {
        if (!restoring.current) restoring.current = readSession()
        const result = await restoring.current
        if (live) { if (result.recovery) setRecovery(true); else setUser(result.user) }
      } catch (failure) { if (live && failure.status !== 401) setError(failure.message) }
      finally { if (live) setLoading(false) }
    }
    restore()
    return () => { live = false }
  }, [])
  const value = {
    user, loading, error, recovery,
    async login(email, password) { const result = await api('/auth/login', { email, password }); setUser(result.user); setError(''); return result.user },
    signup: (email, password) => api('/auth/signup', { email, password }),
    recover: (email) => api('/auth/recover', { email }),
    async updateProfile(display_name){const result=await api('/profile',{display_name},'PATCH');setUser(result.user);return result},
    async password(password) { const result = await api('/auth/password', { password }); setRecovery(false); const session = await api('/auth/session'); setUser(session.user); return result },
    async logout() { try { await api('/auth/logout', {}) } finally { setUser(null) } },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
export const useAuth = () => useContext(AuthContext)
