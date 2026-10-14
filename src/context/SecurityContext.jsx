/* oxlint-disable react/only-export-components */
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from './AuthContext.jsx'
import { api } from '../utils/api.js'
import { defaultPolicies } from '../utils/securityLab.js'
const SecurityContext = createContext(null)
const empty = () => ({ policies: { ...defaultPolicies }, events: [], alerts: [], audit: [], blockedIPs: [], ledger: [], accounts: [], accountLogs: [], model: null, summary: null, summaryError: '', loaded: false })
export function SecurityProvider({ children }) {
  const { user } = useAuth()
  const [state, setState] = useState(empty), [error, setError] = useState(''), [loading, setLoading] = useState(false)
  const flight = useRef(null)
  const currentUser = useRef(user?.id)
  currentUser.current = user?.id
  const reload = useCallback(async ({ force = false } = {}) => {
    if (!user) return
    const requestUser = user.id
    if (flight.current?.userId === requestUser) {
      if (!force) return flight.current.promise
      await flight.current.promise.catch(() => {})
      if (currentUser.current !== requestUser) return
    }
    setLoading(true)
    const promise = (async () => {
      let accessDenied = false
      const stateRequest = api('/state').then(data => {
        if (currentUser.current === requestUser) {
          setState(previous => ({ ...data, summary: previous.summary, summaryError: previous.summaryError, loaded: true }))
          setError('')
        }
        return data
      }).catch(failure => {
        if (currentUser.current === requestUser) {
          setError(failure.message)
          if ([401,403,423].includes(failure.status)) { accessDenied = true; setState(empty()) }
        }
        throw failure
      })
      const summaryRequest = api('/summary').then(summary => {
        if (!accessDenied && currentUser.current === requestUser) setState(previous => ({ ...previous, summary, summaryError: '' }))
      }).catch(failure => {
        if (currentUser.current === requestUser) setState(previous => ({ ...previous, summaryError: failure.message }))
      })
      const [result] = await Promise.allSettled([stateRequest, summaryRequest])
      if (result.status === 'rejected') throw result.reason
      return result.value
    })()
    flight.current = { userId: requestUser, promise }
    try { return await promise }
    finally {
      if (flight.current?.promise === promise) {
        flight.current = null
        if (currentUser.current === requestUser) setLoading(false)
      }
    }
  }, [user])
  useEffect(() => {
    setState(empty()); setError('')
    if (!user) return
    reload().catch(() => {})
    const timer = setInterval(() => reload().catch(() => {}), 30000)
    return () => clearInterval(timer)
  }, [user, reload])
  async function mutate(path, body, method) { const result = await api(path, body, method); await reload({ force: true }); return result }
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
