import { useState } from 'react'
import { encryptAESGCM, sha256Digest } from '../../utils/webCrypto.js'
import { useTelemetry } from '../../context/TelemetryContext.jsx'

export default function EncryptionWorkbench({ onCiphertext }) {
  const telemetry = useTelemetry()
  const [plaintext, setPlaintext] = useState('')
  const [passphrase, setPassphrase] = useState('')
  const [rounds, setRounds] = useState(120000)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  async function encryptPayload() {
    setBusy(true)
    setError('')
    try {
      const encrypted = await encryptAESGCM(plaintext, passphrase, rounds)
      const entry = {
        operation: 'Encrypt',
        algorithm: encrypted.alg,
        digest: await sha256Digest(encrypted.armor),
        status: 'Sealed',
      }
      setResult(encrypted)
      onCiphertext(encrypted.armor, passphrase)
      await telemetry.addLedgerEntry(entry)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="glass-panel workbench">
      <div className="panel-heading">
        <div>
          <span>Encryption Pipeline</span>
          <h3>AES-256-GCM / PBKDF2</h3>
        </div>
        <span className="tag">Authenticated encryption</span>
      </div>
      <textarea aria-label="AES plaintext" value={plaintext} onChange={(event) => setPlaintext(event.target.value)} />
      <label>
        Algorithm
        <select defaultValue="AES-256-GCM">
          <option>AES-256-GCM</option>
        </select>
      </label>
      <label>
        Passphrase
        <input value={passphrase} onChange={(event) => setPassphrase(event.target.value)} type="password" />
      </label>
      <label>
        PBKDF2 rounds: {rounds.toLocaleString()}
        <input
          max="260000"
          min="80000"
          onChange={(event) => setRounds(Number(event.target.value))}
          step="10000"
          type="range"
          value={rounds}
        />
      </label>
      <button className="primary-action" disabled={busy || !passphrase || !plaintext} onClick={encryptPayload} type="button">
        {busy ? 'Encrypting...' : 'Encrypt Payload'}
      </button>
      <output className="cipher-output">{result?.armor ?? 'Ciphertext armor will appear here.'}</output>
      {error && <p role="alert">{error}</p>}
    </section>
  )
}
