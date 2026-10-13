import { useState } from 'react'
import CryptoAuditLedger from '../components/crypto/CryptoAuditLedger.jsx'
import DecryptionWorkbench from '../components/crypto/DecryptionWorkbench.jsx'
import EncryptionWorkbench from '../components/crypto/EncryptionWorkbench.jsx'
import ClassicalWorkbench from '../components/crypto/ClassicalWorkbench.jsx'

export default function CryptoStudio() {
  const [ciphertext, setCiphertext] = useState('')
  const [passphrase, setPassphrase] = useState('')

  return (
    <section className="stack-view">
      <div className="view-header">
        <div>
          <span className="eyebrow">Cryptography Studio & Workbench</span>
          <h1>Encryption & decryption</h1>
        </div>
      </div>
      <ClassicalWorkbench />
      <details className="glass-panel aes-studio">
      <summary>AES-256-GCM · authenticated payload sealing</summary>
      <div className="studio-grid">
        <EncryptionWorkbench
          onCiphertext={(armor, key) => {
            setCiphertext(armor)
            setPassphrase(key)
          }}
        />
        <DecryptionWorkbench ciphertext={ciphertext} passphrase={passphrase} />
      </div>
      </details>
      <CryptoAuditLedger />
    </section>
  )
}
