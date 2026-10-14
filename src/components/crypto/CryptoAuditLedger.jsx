import { useTelemetry } from '../../context/TelemetryContext.jsx'

export default function CryptoAuditLedger() {
  const { ledger, loaded, historyError } = useTelemetry()
  const rows = ledger

  return (
    <div className="glass-panel table-panel">
      <div className="panel-heading">
        <div>
          <span>Cipher history</span>
          <h3>Digest-only transaction log</h3>
        </div>
      </div>
      <div className="responsive-table">
        <table>
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Operation</th>
              <th>Algorithm</th>
              <th>SHA-256 Digest</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.id}</td>
                <td>{row.operation}</td>
                <td>{row.algorithm}</td>
                <td className="mono">{row.digest}</td>
                <td><span className="pill allowed">{row.status}</span></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={5}>{historyError ? 'History could not be refreshed.' : !loaded ? 'Loading cipher history...' : 'No cipher operations recorded yet.'}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
