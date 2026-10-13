import { useEffect, useRef, useState } from 'react'
export default function Footer() {
  const [support, setSupport] = useState(false)
  const link = useRef(null), close = useRef(null)
  useEffect(() => {
    if (!support) return
    close.current?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') setSupport(false)
      if (event.key === 'Tab') {
        const controls = [...document.querySelectorAll('#support a, #support button')]
        const index = controls.indexOf(document.activeElement)
        if (event.shiftKey && index <= 0) { event.preventDefault(); controls.at(-1)?.focus() }
        else if (!event.shiftKey && index === controls.length - 1) { event.preventDefault(); controls[0]?.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); link.current?.focus() }
  }, [support])
  return <>
    <footer className="footer"><div className="footer-copy"><span>CRYPTOGUARD · Cryptography & account security</span><span className="footer-support"><span aria-hidden="true">|</span><a ref={link} href="#support" aria-haspopup="dialog" onClick={(event) => { event.preventDefault(); setSupport(true) }}>Support</a></span></div><span>Playfair / Caesar / Bifid / Vigenère / AES-GCM</span></footer>
    {support && <div className="profile-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSupport(false) }}><section id="support" className="profile-login-modal support-modal" role="dialog" aria-modal="true" aria-labelledby="support-title"><button ref={close} className="modal-close" type="button" aria-label="Close support" onClick={() => setSupport(false)}>×</button><h2 id="support-title">CRYPTOGUARD Support</h2><div className="support-profile-list"><a href="https://www.facebook.com/cinanyag" target="_blank" rel="noreferrer noopener"><strong>Cinanyag Support</strong></a><a href="https://www.facebook.com/shan.michael.delmo.daguimol" target="_blank" rel="noreferrer noopener"><strong>Shan Michael Delmo Daguimol</strong></a></div></section></div>}
  </>
}
