import { useEffect, useRef, useState } from 'react'
import DashboardOverview from './DashboardOverview.jsx'
import LogWorkspace from '../views/LogWorkspace.jsx'
import ProfileSettings from '../views/ProfileSettings.jsx'
import { AISecurity, Alerts, Prevention, Reports, PasswordSettings } from '../views/SecurityViews.jsx'
import { useSecurity } from '../context/SecurityContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useTelemetry } from '../context/TelemetryContext.jsx'
import { sha256Digest } from '../utils/webCrypto.js'
import { Activity, AlertTriangle, CheckCircle, Cpu, Lock, Shield, Terminal, User } from '../components/ui/Icons.jsx'
export default function Dashboard({ onLogout }) {
  const security = useSecurity(), { user } = useAuth(), { ledger } = useTelemetry()
  const summary = security.summary
  const admin = user.role === 'admin'
  const [activeView, setActiveView] = useState('Dashboard Overview'), [toast, setToast] = useState(null), [auditing, setAuditing] = useState(false), [accountOpen, setAccountOpen] = useState(false)
  const toastTimer = useRef(null)
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  const openAlerts = security.alerts.filter((alert) => alert.status !== 'Resolved')
  function notify(title, desc, alert = false) { setToast({ title,desc,alert }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 5000) }
  async function audit() { setAuditing(true); try { const digest = await sha256Digest(JSON.stringify({ events: security.events, alerts: security.alerts, policies: security.policies, ledger })); await security.recordAudit('Snapshot SHA-256', digest); notify('Snapshot hashed', 'SHA-256 fingerprint saved to Reports. It is not an external integrity certification.') } catch (error) { notify('Audit failed',error.message,true) } finally { setAuditing(false) } }
  const nav = [['Dashboard Overview',Cpu],...(admin ? [['AI Security',Activity],['Alerts',AlertTriangle],['Prevention',Lock]] : []),['User Activity Logs',Activity],...(admin ? [['Account Logs',User],['Security Events',Shield],['AI Detection Results',Cpu]] : []),['Reports',Terminal]]
  return <div className="dashboard-shell"><aside className="dashboard-sidebar"><div className="dashboard-logo"><Shield /><div><strong>CRYPTOGUARD</strong><span>Security Dashboard</span></div></div><span className="dashboard-nav-label">Workspace</span><nav className="dashboard-nav">{nav.map(([label,Icon]) => <button type="button" className={activeView === label ? 'active' : ''} aria-current={activeView === label ? 'page' : undefined} key={label} onClick={() => setActiveView(label)}><Icon />{label}</button>)}</nav><div className="dashboard-mini-status"><span>{user.email}</span><strong>{admin ? 'ADMINISTRATOR' : 'USER'}</strong></div></aside><div className="dashboard-main"><header className="dashboard-topbar"><nav><button type="button" onClick={() => setActiveView('Dashboard Overview')}>Activity</button>{admin && <button type="button" onClick={() => setActiveView('Alerts')}>Alerts {openAlerts.length ? `(${openAlerts.length})` : ''}</button>}<button type="button" onClick={() => setActiveView('Reports')}>Audit Vault</button><button type="button" disabled={security.loading} onClick={() => security.reload().catch((error) => notify('Refresh failed',error.message,true))}>Refresh</button></nav><div className="dashboard-user-group"><button type="button" aria-pressed={accountOpen} onClick={() => setAccountOpen(!accountOpen)}>Account</button><button className="dashboard-profile" type="button" aria-label="Logout to landing" onClick={() => onLogout().catch((error) => notify('Logout failed',error.message,true))}><User /></button></div></header><main className="dashboard-content">{security.error && <p role="alert" className="security-error">{security.error}</p>}{security.summaryError && <p role="status" className="security-lab-notice">Statistics could not be refreshed: {security.summaryError}</p>}{accountOpen && <section className="workspace-account-grid" aria-label="Account settings"><ProfileSettings /><PasswordSettings /></section>}{['User Activity Logs','Account Logs','Security Events','AI Detection Results'].includes(activeView) ? <LogWorkspace key={activeView} kind={{'User Activity Logs':'activity','Account Logs':'account','Security Events':'security','AI Detection Results':'model'}[activeView]} /> : activeView === 'AI Security' && admin ? <AISecurity summary={summary} /> : activeView === 'Alerts' && admin ? <Alerts /> : activeView === 'Prevention' && admin ? <Prevention summary={summary} /> : activeView === 'Reports' ? <Reports onAudit={audit} auditing={auditing} /> : <DashboardOverview user={user} security={security} ledger={ledger} summary={summary} onNavigate={setActiveView} onRefresh={() => security.reload().catch(error => notify('Refresh failed',error.message,true))} />}</main></div>{toast && <div className={`dashboard-toast ${toast.alert ? 'alert' : ''}`} role="status">{toast.alert ? <AlertTriangle /> : <CheckCircle />}<div><strong>{toast.title}</strong><span>{toast.desc}</span></div></div>}</div>
}



