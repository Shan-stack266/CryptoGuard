import { useEffect, useState } from 'react'

export default function ModelTimeline({ events }) {
 const [now, setNow] = useState(Date.now)
 useEffect(() => { const timer=setInterval(() => setNow(Date.now()),30000); return () => clearInterval(timer) }, [])
 const counts=Array.from({length:12},(_,index) => events.filter(event => {
  const model=event.model?.review ?? event.model
  const age=now-Date.parse(model?.reviewed_at ?? event.timestamp)
  return model?.anomalous && age >= (11-index)*300000 && age < (12-index)*300000
 }).length)
 return <article className="dashboard-panel"><div><h2>ML Detections Over Time</h2><p>Loaded anomaly detections in the last hour, grouped into 5-minute intervals.</p></div>{counts.some(Boolean) ? <div className="dashboard-bar-chart" role="img" aria-label={`Anomaly detections by interval: ${counts.join(', ')}`} >{counts.map((count,index) => <div key={index}><i style={{height:`${120*count/Math.max(1,...counts)}px`}} /><span>{count}</span></div>)}</div> : <p className="security-empty">No anomaly detections recorded in the last hour.</p>}</article>
}
