import { useEffect, useState } from 'react'
import { Activity, Lock, Shield, User } from '../ui/Icons.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
export default function Navbar({ onNavigate }) {
  const auth = useAuth()
  const [open, setOpen] = useState(auth.recovery)
  const [mode, setMode] = useState(auth.recovery ? 'reset' : 'login')
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [fullName, setFullName] = useState(''), [username, setUsername] = useState(''), [confirmPassword, setConfirmPassword] = useState('')
  const [visible, setVisible] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  useEffect(() => {
    const show = () => { setMode(auth.recovery ? 'reset' : 'login'); setMessage(''); setOpen(true) }
    window.addEventListener('cryptoguard:open-login', show)
    return () => window.removeEventListener('cryptoguard:open-login', show)
  }, [auth.recovery])
  function changeMode(next) { setMode(next); setMessage(''); setPassword(''); setConfirmPassword('') }
  async function submit(event) {
    event.preventDefault(); setBusy(true); setMessage('')
    try {
      if (mode === 'login') await auth.login(email, password)
      else if (mode === 'signup') {
        if (password !== confirmPassword) throw new Error('Passwords do not match.')
        const result = await auth.signup({ full_name: fullName.trim(), username: username.trim(), email, password, confirm_password: confirmPassword })
        setPassword(''); setConfirmPassword(''); setFullName(''); setUsername(''); setMode('login'); setMessage(result.message)
      }
      else if (mode === 'forgot') { const result = await auth.recover(email); setMessage(result.message) }
      else { const result = await auth.password(password); setPassword(''); setMessage(result.message) }
    } catch (failure) { setMessage(failure.message) }
    finally { setBusy(false) }
  }
  const title = { login: 'Welcome back', signup: 'Create account', forgot: 'Recover access', reset: 'Set new password' }[mode]
  return <>
    <header className="navbar"><button className="brand-lock" type="button" onClick={() => onNavigate('landing')}><Shield /><span>CRYPTOGUARD</span></button><div className="status-badge"><Activity /><span>Cryptography & security</span></div><button className="avatar-toggle" type="button" aria-label="Open profile login" onClick={() => { changeMode(auth.recovery ? 'reset' : 'login'); setOpen(true) }}><User /></button></header>
    {open && <div className="profile-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false) }}><section className={`profile-login-modal ${mode === 'signup' ? 'signup-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="profile-login-title"><button className="modal-close" type="button" aria-label="Close login" disabled={busy} onClick={() => setOpen(false)}>×</button><div className="login-brand-mark"><Lock /></div><span className="eyebrow">CRYPTOGUARD &middot; Account access</span><h2 id="profile-login-title">{title}</h2><p>{mode === 'forgot' ? 'Receive a password recovery link at your registered email.' : mode === 'signup' ? 'Enter your full name, a unique username, email, and matching passwords.' : mode === 'reset' ? 'Your email recovery link verifies access. Choose a new password.' : 'Log in with your email and password.'}</p>
      <form className="premium-login-form" onSubmit={submit}>
        {mode === 'signup' && <div className="signup-identities"><label>Full name<input type="text" required minLength={2} maxLength={100} autoComplete="name" value={fullName} onChange={event => setFullName(event.target.value)} /></label><label>Username<input aria-label="Username" type="text" required minLength={3} maxLength={30} pattern="[A-Za-z0-9_]{3,30}" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-describedby="signup-username-help" value={username} onChange={event => setUsername(event.target.value)} /><small id="signup-username-help">3-30 letters, numbers, or underscores. Usernames are case-insensitive.</small></label></div>}

        {mode !== 'reset' && <label>Email address<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
        {mode !== 'forgot' && <><label>{mode === 'reset' ? 'New password' : 'Password'}<input type={visible ? 'text' : 'password'} minLength={mode === 'login' ? undefined : 8} maxLength={256} required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></label></>}
        {mode === 'signup' && <label>Confirm password<input type={visible ? 'text' : 'password'} minLength={8} maxLength={256} required autoComplete="new-password" aria-invalid={Boolean(confirmPassword && password !== confirmPassword)} value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>}
        {mode !== 'forgot' && <button className="secondary-action" type="button" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Hide password' : 'Show password'}</button>}
        {message && <p className="strict-note" role="status">{message}</p>}
        <div className="login-help-links">{mode === 'login' ? <><button type="button" disabled={busy} onClick={() => changeMode('forgot')}>Forgot password?</button><button type="button" disabled={busy} onClick={() => changeMode('signup')}>Sign up</button></> : !auth.recovery && <button type="button" disabled={busy} onClick={() => changeMode('login')}>Back to login</button>}</div>
        <button className="primary-action" type="submit" disabled={busy}>{busy ? 'Please wait...' : mode === 'login' ? 'Log in' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send recovery email' : 'Save new password'}</button>
      </form><div className="login-modal-footer"><span>Protected account access</span><strong>Email & password</strong></div>
    </section></div>}
  </>
}

