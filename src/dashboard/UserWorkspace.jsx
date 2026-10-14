import { useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useSecurity } from '../context/SecurityContext.jsx'
import CryptoStudio from '../views/CryptoStudio.jsx'
import CryptoAuditLedger from '../components/crypto/CryptoAuditLedger.jsx'
import ProfileSettings from '../views/ProfileSettings.jsx'
import LogWorkspace from '../views/LogWorkspace.jsx'
import { PasswordSettings, Reports } from '../views/SecurityViews.jsx'
import { Shield } from '../components/ui/Icons.jsx'

const ciphers=[['playfair','Playfair'],['caesar','Caesar'],['bifid','Bifid'],['vigenere','Vigen\u00e8re']]
export default function UserWorkspace({ onLogout }) {
 const {user}=useAuth(),security=useSecurity()
 const [cipher,setCipher]=useState('playfair'),[monitor,setMonitor]=useState('history'),[accountOpen,setAccountOpen]=useState(false),[message,setMessage]=useState('')
 const openAlerts=security.alerts.filter(alert=>alert.status!=='Resolved').length
 async function refresh(){try{await security.reload();setMessage('Records refreshed.')}catch(error){setMessage(error.message)}}
 return <div className="dashboard-shell user-workspace">
  <header className="user-topbar"><div className="user-brand"><Shield /><div><strong>CRYPTOGUARD</strong><small>Cryptography workspace</small></div></div><div className="user-account-actions"><button type="button" aria-pressed={accountOpen} onClick={()=>setAccountOpen(!accountOpen)}>Account</button><button type="button" disabled={security.loading} onClick={refresh}>Refresh</button><button type="button" onClick={()=>onLogout().catch(error=>setMessage(error.message))}>Sign out</button></div></header>
  <nav className="user-cipher-nav" aria-label="Cipher navigation"><div className="cipher-selector" role="group" aria-label="Select cipher">{ciphers.map(([id,label])=><button type="button" aria-pressed={id===cipher} key={id} onClick={()=>setCipher(id)}>{label}</button>)}</div><span className="user-identity">{user.display_name||user.email}</span></nav>
  <main className="user-content">{security.error&&<p role="alert" className="security-error">{security.error}</p>}{message&&<p role="status" className="security-feedback">{message}</p>}{accountOpen&&<section className="workspace-account-grid" aria-label="Account settings"><ProfileSettings /><PasswordSettings /></section>}
   <CryptoStudio cipher={cipher} includeHistory={false} />
   <section className="user-monitoring" aria-labelledby="user-records-title"><div className="user-records-heading"><div><h2 id="user-records-title">Your records</h2><p>Monitor your own activity, security alerts, and saved cipher operations.</p></div><span className="security-tag">{openAlerts} unresolved alerts</span></div><nav className="user-record-nav" aria-label="Your records">{[['history','Cipher history'],['activity','Activity logs'],['alerts','Alerts'],['reports','Reports']].map(([id,label])=><button type="button" aria-pressed={monitor===id} key={id} onClick={()=>setMonitor(id)}>{label}</button>)}</nav><div className="user-record-panel">{monitor==='history'?<CryptoAuditLedger />:monitor==='reports'?<Reports />:<LogWorkspace key={monitor} kind={monitor} />}</div></section>
  </main>
 </div>
}
