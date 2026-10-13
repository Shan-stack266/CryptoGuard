import { useState } from 'react'
import { decryptAESGCM, sha256Digest } from '../../utils/webCrypto.js'
import { useTelemetry } from '../../context/TelemetryContext.jsx'

export default function DecryptionWorkbench({ ciphertext, passphrase }) {
  const telemetry = useTelemetry()
  const [localCiphertext, setLocalCiphertext] = useState('')
  const [key, setKey] = useState('')
  const [plaintext, setPlaintext] = useState('')
  const [status, setStatus] = useState('Awaiting AEAD tag')

  async function decryptPayload() {
    try {
      const decrypted = await decryptAESGCM(localCiphertext || ciphertext, key || passphrase)
      setPlaintext(decrypted)
      setStatus('AES-GCM authentication verified')
      try { await telemetry.addLedgerEntry({ algorithm: 'AES-256-GCM', operation: 'Decrypt', digest: await sha256Digest(decrypted) }) }
      catch (failure) { setStatus(`Decrypted, but history was not saved: ${failure.message}`) }
    } catch {
      setPlaintext('')
      setStatus('Authentication failed / payload rejected')
    }
  }

  return (
    <section className="glass-panel workbench">
      <div className="panel-heading">
        <div>
          <span>Decryption & Integrity</span>
          <h3>Authenticated recovery</h3>
        </div>
        <span className="tag">{status.includes('verified') ? 'verified' : 'armed'}</span>
      </div>
      <textarea
        placeholder="Paste Base64 armor"
        value={localCiphertext || ciphertext}
        onChange={(event) => setLocalCiphertext(event.target.value)}
      />
      <label>
        Master key
        <input
          placeholder="Use matching passphrase"
          type="password"
          value={key || passphrase}
          onChange={(event) => setKey(event.target.value)}
        />
      </label>
      <button className="secondary-action" disabled={!(localCiphertext || ciphertext)} onClick={decryptPayload} type="button">
        Decrypt Payload
      </button>
      <div className="integrity-status">{status}</div>
      <output className="plain-output">{plaintext || 'Recovered plaintext preview will appear here.'}</output>
    </section>
  )
}
