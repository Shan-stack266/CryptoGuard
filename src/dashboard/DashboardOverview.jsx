import { useEffect, useMemo, useState } from 'react'
import { ActivityTable, formatTime } from '../views/SecurityViews.jsx'
import { Activity, AlertTriangle, Key, Shield } from '../components/ui/Icons.jsx'

export default function DashboardOverview({ security, ledger, onNavigate, onRefresh }) {
  const [query, setQuery] = useState('')
  const alerts = security.alerts.filter(item => item.status !== 'Resolved')
  const recent = useMemo(() => security.events.filter(item => `${item.identity} ${item.ip} ${item.operation} ${item.decision}`.toLowerCase().includes(query.toLowerCase())).slice(0, 5), [security.events, query])
  const cards = [
    ['Recorded Activity', security.events.length, 'Latest loaded records', Activity],
    ['Cipher Operations', ledger.length, 'Latest saved operations', Key],
    ['Open Alerts', alerts.length, 'Loaded alerts awaiting resolution', AlertTriangle],
    ['Blocked Activity', security.events.filter(item => item.decision === 'Blocked').length, 'Latest denied operations', Shield],
  ]
  const [now, setNow] = useState(Date.now)
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer) }, [])
  const buckets = Array.from({length:12}, (_,i) => security.events.filter(item => {
    const age = now - Date.parse(item.timestamp)
    return age >= (11-i)*300000 && age < (12-i)*300000
  }).length)
  const max = Math.max(1, ...buckets)
  const points = buckets.map((count,i) => `${i*500/11},${140-count/max*120}`).join(' ')
  const loginAttempts = security.events.filter(item => ['Login','Login failed'].includes(item.operation)).length
  const resolved = security.alerts.filter(item => item.status === 'Resolved').length
  const resolvedPercent = security.alerts.length ? Math.round(100*resolved/security.alerts.length) : 0
  const activity = <article className="dashboard-panel overview-activity">
    <div className="dashboard-table-head"><div><h2>Recent Security Activity</h2><p>Latest {recent.length} activities{query ? ' matching your search' : ''}</p></div><input aria-label="Filter security activity" value={query} onChange={event => setQuery(event.target.value)} /></div>
    <ActivityTable events={recent} compact />
    <div className="overview-card-footer"><button className="secondary-action" type="button" onClick={() => onNavigate('User Activity Logs')}>View all activity</button></div>
  </article>
  return <section className="dashboard-overview overview-admin">
    <header className="overview-heading"><div><span className="security-eyebrow">Administrator workspace</span><h1>CRYPTOGUARD Overview</h1><p>Monitor activity and review the records that need attention.</p></div><div className="security-actions"><button className="secondary-action" type="button" disabled={security.loading} onClick={onRefresh}>Refresh overview</button><button className="secondary-action" type="button" onClick={() => onNavigate('Reports')}>View reports</button></div></header>
    <section className="dashboard-stat-grid overview-stats" aria-busy={!security.loaded}>{cards.map(([label,value,detail,Icon]) => <article className="dashboard-stat-card" key={label}><div><span>{label}</span><Icon /></div><strong>{security.loaded ? value : '...'}</strong><small>{detail}</small></article>)}</section>
    <p className="security-lab-notice">Recent counts use loaded records unless marked as a database count. Activity refreshes every 30 seconds.</p>
    <>
      <section className="overview-split"><article className="dashboard-panel overview-throughput"><div><h2>Activity in the Last Hour</h2><p>Loaded records in 5-minute intervals</p></div>{buckets.some(Boolean) ? <svg viewBox="0 0 500 150" role="img" aria-label="Recorded activity count over the last hour"><polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="3" /></svg> : <p className="security-empty">No recorded activity in the last hour.</p>}</article><article className="dashboard-panel"><h2>Recent Risk Scores</h2>{security.events.length ? <div className="dashboard-bar-chart">{security.events.slice(0,6).reverse().map(item => <div key={item.id} title={`${item.identity}: ${item.score}/100`}><i style={{height:`${item.score*1.2}px`}} /><span>{item.score}</span></div>)}</div> : <p className="security-empty">No risk records yet.</p>}</article></section>
      <section className="overview-split">{activity}<article className="dashboard-panel overview-alerts"><h2>Unresolved Alerts</h2>{alerts.length ? <div className="dashboard-feed">{alerts.slice(0,3).map(item => <div key={item.id}><strong>{item.severity} - {item.score}/100</strong><p>{item.identity}</p><p className="overview-alert-title" title={item.title}>{item.title}</p><small>{item.status}</small></div>)}</div> : <p className="security-empty">No unresolved alerts.</p>}{security.accountLogs.length > 0 && <div className="overview-account-changes"><h3>Recent Account Changes</h3>{security.accountLogs.slice(0,2).map(item => <div key={item.id}><strong>{item.operation}</strong><small>{formatTime(item.timestamp)}</small></div>)}<button className="secondary-action" type="button" onClick={() => onNavigate('Account Logs')}>Open account logs</button></div>}<div className="overview-card-footer"><button className="secondary-action" type="button" onClick={() => onNavigate('Alerts')}>View all alerts</button></div></article></section>
      <section className="overview-three"><article className="dashboard-panel security-view"><h2>Login Outcomes</h2>{['Login','Login failed'].map(operation => {const count = security.events.filter(item => item.operation === operation).length; const label = operation === 'Login' ? 'Successful' : 'Failed'; return <div key={operation}><span>{label}: {count}</span><meter aria-label={`${label} login count`} min="0" max={Math.max(1,loginAttempts)} value={count} /></div>})}<p className="overview-card-footer">{loginAttempts} login attempts in the loaded records.</p></article><article className="dashboard-panel security-view"><h2>Events by Severity</h2>{['Low','Medium','High','Critical'].map(severity => {const count = security.events.filter(item => item.severity === severity).length; return <div key={severity}><span>{severity}: {count}</span><meter aria-label={`${severity} event count`} min="0" max={Math.max(1,security.events.length)} value={count} /></div>})}</article><article className="dashboard-panel overview-resolution"><h2>Alert Resolution</h2>{security.alerts.length ? <div className="dashboard-donut-wrap"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="38" /><circle cx="50" cy="50" r="38" strokeDasharray={`${238.76*resolvedPercent/100} 238.76`} /></svg><div><strong>{resolvedPercent}%</strong><span>Resolved</span></div></div> : <p className="security-empty">No alerts recorded yet.</p>}</article></section>
    </>
  </section>
}
