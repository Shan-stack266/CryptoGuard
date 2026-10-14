import { useState } from 'react'
import { ALPHABET, caesar, createSquare, runCipher } from '../../utils/classicalCiphers.js'
import { sha256Digest } from '../../utils/webCrypto.js'
import { useTelemetry } from '../../context/TelemetryContext.jsx'
import './classical.css'

const ciphers = {
  playfair: { name: 'Playfair', explanation: 'Pairs of letters move right in the same row, down in the same column, or swap columns at rectangle corners. Decryption reverses the moves.' },
  caesar: { name: 'Caesar', shift: '0', explanation: 'Encryption adds the shift modulo 26; decryption subtracts it. Letter case, spaces, numbers, punctuation, and non-ASCII characters are preserved.' },
  bifid: { name: 'Bifid', period: '5', explanation: 'Each period block becomes row and column coordinates. Encryption joins all rows then all columns and reads pairs. Decryption splits ciphertext coordinates into equal halves and reunites them.' },
  vigenere: { name: 'Vigenère', explanation: 'With A = 0, encryption computes (message + key) mod 26; decryption computes (ciphertext − key) mod 26. Only A–Z letters advance the key; case and other characters are preserved.' },
}

function Square({ square, title }) {
  return <table className="cipher-square"><caption>{title} · I/J share a cell</caption>
    <thead><tr><th scope="col">r / c</th>{[1, 2, 3, 4, 5].map((n) => <th scope="col" key={n}>{n}</th>)}</tr></thead>
    <tbody>{[0, 1, 2, 3, 4].map((r) => <tr key={r}><th scope="row">{r + 1}</th>{[0, 1, 2, 3, 4].map((c) => <td key={c}>{square[r * 5 + c] === 'I' ? 'I/J' : square[r * 5 + c]}</td>)}</tr>)}</tbody>
  </table>
}

function ScrollTable({ children, label }) {
  return <div className="cipher-table-scroll" role="region" aria-label={label} tabIndex={0}>{children}</div>
}

function Visualization({ cipher, settings, result, selectedStep, onSelectStep }) {
  let square, mapping
  try {
    if (cipher === 'playfair' || cipher === 'bifid') square = createSquare(settings.keyword)
    if (cipher === 'caesar') mapping = caesar('', settings.shift, result?.decrypt).shiftedAlphabet
  } catch (error) {
    return <p className="cipher-note">{error.message}</p>
  }
  const step = result?.steps?.[selectedStep]
  const keyIndex = step ? ALPHABET.indexOf(step.key) : -1
  // On decrypt, find ciphertext in the key row: the recovered letter is the column.
  const columnIndex = step ? ALPHABET.indexOf((result.decrypt ? step.output : step.input).toUpperCase()) : -1
  return <>
    {square && <Square square={square} title={cipher === 'playfair' ? '5 × 5 key matrix' : '5 × 5 Polybius square'} />}
    {cipher === 'caesar' && <ScrollTable label="Alphabet substitution"><table className="cipher-alphabet"><caption>{result?.decrypt ? 'Decryption: ciphertext → plaintext (backward shift)' : 'Encryption: plaintext → ciphertext (forward shift)'}</caption><tbody>
      <tr><th scope="row">Original</th>{[...ALPHABET].map((c) => <td key={c}>{c}</td>)}</tr>
      <tr><th scope="row">Shifted</th>{[...mapping].map((c) => <td key={c}>{c}</td>)}</tr>
    </tbody></table></ScrollTable>}
    {cipher === 'vigenere' && <>
      <p className="cipher-note">Select a processed letter below to highlight its key row, plaintext column, and ciphertext cell.</p>
      {step && <p className="cipher-trace">{step.input} with key {step.key} → {step.output}</p>}
      <ScrollTable label="Vigenère tabula recta"><table className="cipher-tabula"><caption>26 × 26 Tabula Recta · rows: key · columns: plaintext</caption>
        <thead><tr><th scope="col">Key</th>{[...ALPHABET].map((c, i) => <th scope="col" className={i === columnIndex ? 'highlight' : ''} key={c}>{c}</th>)}</tr></thead>
        <tbody>{[...ALPHABET].map((r, ri) => <tr key={r}><th scope="row" className={ri === keyIndex ? 'highlight' : ''}>{r}</th>{[...ALPHABET].map((c, ci) => <td className={ri === keyIndex && ci === columnIndex ? 'intersection' : ri === keyIndex || ci === columnIndex ? 'highlight' : ''} key={c}>{ALPHABET[(ri + ci) % 26]}</td>)}</tr>)}</tbody>
      </table></ScrollTable>
    </>}
    {result && <div className="cipher-processing"><h3>Processing steps · {result.decrypt ? 'decrypt' : 'encrypt'}</h3>
      {cipher === 'playfair' && <>
        <p className="cipher-note">{result.pairCount} pairs · {result.fillers} fillers inserted. Showing the first {result.steps.length} pairs.</p>
        <ScrollTable label="Playfair letter pairs"><table><thead><tr><th scope="col">Input pair</th><th scope="col">Rule</th><th scope="col">Output pair</th></tr></thead><tbody>{result.steps.map((s, i) => <tr key={i}><td>{s.input}</td><td>{s.rule}</td><td>{s.output}</td></tr>)}</tbody></table></ScrollTable>
      </>}
      {cipher === 'bifid' && <>
        <p className="cipher-note">Period {result.period} · {result.blockCount} blocks. Showing the first {result.blocks.length} blocks. Coordinate traces show up to 100 letters per block.</p>
        {result.blocks.map((block, i) => <div className="cipher-block" key={i}><h4>Block {i + 1}: {block.input.slice(0, 100)}{block.input.length > 100 ? '…' : ''} → {block.output.slice(0, 100)}{block.output.length > 100 ? '…' : ''}</h4>
          <ScrollTable label={`Block ${i + 1} coordinates`}><table className="cipher-alphabet"><tbody>
            <tr><th scope="row">Input</th>{[...block.input].slice(0, 100).map((c, n) => <td key={n}>{c}</td>)}</tr>
            <tr><th scope="row">Row</th>{block.coords.slice(0, 100).map((c, n) => <td key={n}>{c[0]}</td>)}</tr>
            <tr><th scope="row">Column</th>{block.coords.slice(0, 100).map((c, n) => <td key={n}>{c[1]}</td>)}</tr>
          </tbody></table></ScrollTable>
          <p className="cipher-trace">{result.decrypt ? 'Read ciphertext coordinate pairs, then split equally' : 'Join rows, then columns'}: {block.stream.slice(0, 200).join(' ')}{block.stream.length > 200 ? ' …' : ''}</p>
          {result.decrypt && <><p className="cipher-trace">Recovered rows: {block.rows.slice(0, 100).join(' ')}</p><p className="cipher-trace">Recovered columns: {block.columns.slice(0, 100).join(' ')}</p></>}
          <p className="cipher-trace">{result.decrypt ? 'Zip halves into plaintext pairs' : 'Read successive ciphertext pairs'}: {block.resultPairs.slice(0, 100).map((c) => c.join('')).join(' ')}{block.resultPairs.length > 100 ? ' …' : ''}</p>
        </div>)}
      </>}
      {cipher === 'vigenere' && <><p className="cipher-note">{result.letterCount} letters processed. Showing the first {result.steps.length} letters.</p><div className="cipher-letter-steps">{result.steps.map((s, i) => <button type="button" aria-pressed={selectedStep === i} onClick={() => onSelectStep(i)} key={i}>{i + 1}: {s.input} {result.decrypt ? '−' : '+'} {s.key} → {s.output}</button>)}</div></>}
      {cipher === 'caesar' && <p className="cipher-note">{result.decrypt ? 'Subtract' : 'Add'} {settings.shift} to each A–Z letter index, wrapping modulo 26. All other characters stay in place.</p>}
    </div>}
  </>
}

export default function ClassicalWorkbench({ externalCipher, hideSelector = false }) {
  const { addLedgerEntry } = useTelemetry()
  const [localCipher, setCipher] = useState('playfair')
  const cipher = externalCipher ?? localCipher
  const [drafts, setDrafts] = useState(() => Object.fromEntries(Object.entries(ciphers).map(([id, config]) => [id, { ...config, message: '', keyword: '', shift: '0' }])))
  const [storedResult, setResult] = useState(null)
  const result = storedResult?.cipher === cipher ? storedResult : null
  const [errorState, setErrorState] = useState(null)
  const error = errorState?.cipher === cipher ? errorState.text : ''
  const setError = text => setErrorState({ cipher, text })
  const [feedbackState, setFeedbackState] = useState(null)
  const feedback = feedbackState?.cipher === cipher ? feedbackState.text : ''
  const setFeedback = text => setFeedbackState({ cipher, text })
  const [saving, setSaving] = useState(false)
  const [selectedStep, setSelectedStep] = useState(0)
  const settings = drafts[cipher]
  const squareCipher = cipher === 'playfair' || cipher === 'bifid'

  function resetResult() { setResult(null); setError(''); setFeedback(''); setSelectedStep(0) }
  function update(field, value) {
    setDrafts((current) => ({ ...current, [cipher]: { ...current[cipher], [field]: value } }))
    resetResult()
  }
  async function process(decrypt) {
    if (saving) return
    resetResult()
    setSaving(true)
    try {
      const next = { ...runCipher(cipher, settings.message, settings, decrypt), decrypt, cipher }
      setResult(next)
      // Keep the existing digest-only ledger; never store plaintext or keywords.
      setFeedback('Result ready. Saving cipher history...')
      try {
        await addLedgerEntry({ operation: decrypt ? 'Decrypt' : 'Encrypt', algorithm: ciphers[cipher].name, digest: await sha256Digest(next.output) })
        setFeedback('Result ready. Cipher history saved.')
      } catch (failure) { setFeedback(`Result ready, but history was not saved: ${failure.message}`) }
    } catch (failure) { setError(failure.message) }
    finally { setSaving(false) }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(result.output); setFeedback('Result copied.') }
    catch { setFeedback('Clipboard unavailable. Select and copy the result field manually.') }
  }

  return <section className="classical-studio" aria-label="Classical cipher workbench">
    {!hideSelector && <div className="cipher-selector" role="group" aria-label="Select cipher">{Object.entries(ciphers).map(([id, config]) => <button type="button" aria-pressed={id === cipher} key={id} onClick={() => { setCipher(id); resetResult() }}>{config.name}</button>)}</div>}
    <div className="cipher-layout">
      <section className="glass-panel workbench cipher-controls">
        <div className="panel-heading"><div><span>Classical cipher</span><h2>{ciphers[cipher].name}</h2></div><span className="tag">Educational</span></div>
        <p className="cipher-note">{ciphers[cipher].explanation}</p>
        <label htmlFor="classic-message">Plaintext / ciphertext</label>
        <textarea id="classic-message" spellCheck={false} value={settings.message} onChange={(e) => update('message', e.target.value)} aria-describedby={squareCipher ? 'cipher-conventions' : undefined} />
        {cipher === 'caesar' ? <label>Shift (0–25)<input type="number" min="0" max="25" step="1" value={settings.shift} onChange={(e) => update('shift', e.target.value)} /></label> : <label>Keyword (A–Z; spaces allowed)<input value={settings.keyword} onChange={(e) => update('keyword', e.target.value)} spellCheck={false} /></label>}
        {cipher === 'bifid' && <label>Period (default 5; range 1–10,000)<input type="number" min="1" max="10000" step="1" value={settings.period} onChange={(e) => update('period', e.target.value)} /></label>}
        {squareCipher && <p className="cipher-note" id="cipher-conventions">Messages become uppercase A–Z only; J becomes I. Spaces, numbers, punctuation, and non-ASCII characters are removed. {cipher === 'playfair' && 'Repeated pairs and final single letters receive X filler (Q for X). Decryption retains fillers because their removal is ambiguous; original formatting and J cannot be recovered.'}</p>}
        <div className="cipher-actions"><button type="button" className="primary-action" disabled={saving} onClick={() => process(false)}>Encrypt</button><button type="button" className="secondary-action" disabled={saving} onClick={() => process(true)}>Decrypt</button><button type="button" className="secondary-action" onClick={() => update('message', '')}>Clear</button></div>
        {error && <p role="alert" className="cipher-error">{error}</p>}
        <label htmlFor="classic-result">{result ? (result.decrypt ? 'Decrypted result' : 'Encrypted result') : 'Result'}</label>
        <textarea id="classic-result" value={result?.output ?? ''} readOnly placeholder="Your result appears here" aria-live="polite" />
        <button type="button" className="secondary-action" disabled={!result?.output} onClick={copy}>Copy Result</button>
        <p role="status" className="cipher-note">{feedback || (result ? 'Result ready. Editing inputs clears this result.' : 'Choose a cipher, enter a message, then encrypt or decrypt.')}</p>
      </section>
      <section className="glass-panel cipher-visualization"><div className="panel-heading"><div><span>Live visualization</span><h2>{ciphers[cipher].name} tables</h2></div></div><Visualization cipher={cipher} settings={settings} result={result} selectedStep={selectedStep} onSelectStep={setSelectedStep} /></section>
    </div>
  </section>
}

