/* oxlint-disable react/only-export-components */
import { createContext, useContext } from 'react'
import { useSecurity } from './SecurityContext.jsx'
const TelemetryContext = createContext(null)
export function TelemetryProvider({ children }) {
  const security = useSecurity()
  return <TelemetryContext.Provider value={{ ledger: security.ledger, loaded: security.loaded, historyError: security.error, incidents: security.events, encryptedPayloads: security.ledger.filter((entry) => entry.operation === 'Encrypt').length, addLedgerEntry: security.addCipher }}>{children}</TelemetryContext.Provider>
}
export const useTelemetry = () => useContext(TelemetryContext)
