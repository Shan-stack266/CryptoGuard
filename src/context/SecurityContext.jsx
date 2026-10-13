/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext.jsx'
import { api } from '../utils/api.js'
import { defaultPolicies } from '../utils/securityLab.js'
const SecurityContext = createContext(null)
const empty = () => ({ policies: { ...defaultPolicies }, events: [], alerts: [], audit: [], blockedIPs: [], ledger: [], accounts: [], accountLogs: [], model: null })
export function SecurityProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState(empty), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const currentUser = useRef(user?.id)
  currentUser.current = user?.id
  const reload = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const requestUser = user.id
    try { const data = await api('/state'); if (currentUser.current === requestUser) { setState(data); setError('') } return data }
    catch (failure) { if (currentUser.current === requestUser) { setError(failure.message); if ([401,403,423].includes(failure.status)) setState(empty()) } throw failure }
    finally { if (currentUser.current === requestUser) setLoading(false) }
  }, [user])
  useEffect(() => {
    setState(empty()); setError('')
    if (!user) return
    reload().catch(() => {})
    const timer = setInterval(() => reload().catch(() => {}), 30000)
    return () => clearInterval(timer)
  }, [user, reload])
  async function mutate(path, body, method) { const result = await api(path, body, method); await reload(); return result }
  return <SecurityContext.Provider value={{
    ...state, error, loading, reload,
    analyze: (id) => mutate('/security/analyze', { id }),
    savePolicies: (draft) => mutate('/policies', draft, 'PUT'),
    blockIP: (ip, reason) => mutate('/blocks', { ip, reason }),
    unblockIP: (ip) => mutate('/blocks', { ip }, 'DELETE'),
    updateAlert: (id, status, note) => mutate('/alerts', { id, status, note }, 'PATCH'),
    setEmergency: (emergency) => mutate('/policies', { ...state.policies, emergency }, 'PUT'),
    recordAudit: (operation, detail) => mutate('/audit', { operation, detail }),
    updateAccount: (id, role, active, unlock = false) => mutate('/accounts', { id, role, active, unlock }, 'PATCH'),
    addCipher: (entry) => mutate('/ciphers', entry),
  }}>{children}</SecurityContext.Provider>
}
export const useSecurity = () => useContext(SecurityContext)
