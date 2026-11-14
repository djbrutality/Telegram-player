import { useRef, useState, type FormEvent } from 'react'
import { clearCreds, frenchError, getCreds, login, saveCreds, type LoginStep } from '../tg/client'
import { useApp } from '../store'

type Step = 'creds' | LoginStep

const copy: Record<Step, { title: string; text: string; button: string }> = {
  creds: {
    title: 'Vos identifiants Telegram',
    text: 'Onde se connecte à Telegram avec vos propres clés d’application. Elles restent sur ce téléphone et ne sont envoyées qu’à Telegram.',
    button: 'Continuer',
  },
  phone: {
    title: 'Votre numéro',
    text: 'Au format international, par exemple +33612345678. Telegram vous enverra un code.',
    button: 'Recevoir le code',
  },
  code: {
    title: 'Code de connexion',
    text: 'Saisissez le code reçu dans l’application Telegram (ou par SMS).',
    button: 'Valider',
  },
  password: {
    title: 'Mot de passe',
    text: 'Votre compte est protégé par la validation en deux étapes. Saisissez votre mot de passe Telegram.',
    button: 'Se connecter',
  },
}

export function Login({ onDone }: { onDone: () => void }) {
  const notice = useApp((s) => s.loginNotice)
  const [step, setStep] = useState<Step>(getCreds() ? 'phone' : 'creds')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [value, setValue] = useState('')
  const answer = useRef<((v: string) => void) | null>(null)

  // GramJS nous appelle à chaque étape ; on affiche le bon écran et on attend la saisie.
  const ask = (s: LoginStep, err?: string) =>
    new Promise<string>((resolve) => {
      setStep(s)
      setValue('')
      setError(err ?? null)
      setBusy(false)
      answer.current = resolve
    })

  // Lance la connexion avec le numéro saisi ; GramJS rappellera ask() pour la suite.
  const start = (firstPhone: string) => {
    let used = false
    login((s, err) => {
      if (s === 'phone' && !used) {
        used = true
        return Promise.resolve(firstPhone)
      }
      return ask(s, err)
    }).then(onDone, (err) => {
      answer.current = null
      setBusy(false)
      setError(frenchError(err))
    })
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (step === 'creds') {
      const id = Number(apiId.trim())
      const hash = apiHash.trim()
      if (!Number.isInteger(id) || id <= 0) return setError('L’api_id est un nombre (ex. 12345678).')
      if (!/^[a-f0-9]{32}$/i.test(hash)) return setError('L’api_hash fait 32 caractères (chiffres et lettres de a à f).')
      saveCreds(id, hash)
      setStep('phone')
      return
    }
    let v = value.trim()
    if (!v) return
    if (step === 'phone') v = v.replace(/[\s.()-]/g, '')
    setBusy(true)
    if (answer.current) {
      const resolve = answer.current
      answer.current = null
      resolve(v)
    } else {
      start(v)
    }
  }

  const restart = () => {
    clearCreds()
    location.reload()
  }

  const c = copy[step]
  return (
    <div className="scroll login">
      <div className="logo" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <h1 className="brand">Onde</h1>
      {notice && <p className="notice">{notice}</p>}
      <form onSubmit={submit} className="card">
        <h2>{c.title}</h2>
        <p className="muted">{c.text}</p>

        {step === 'creds' && (
          <>
            <label>
              api_id
              <input inputMode="numeric" autoComplete="off" value={apiId} onChange={(e) => setApiId(e.target.value)} placeholder="12345678" />
            </label>
            <label>
              api_hash
              <input autoComplete="off" autoCapitalize="off" autoCorrect="off" spellCheck={false} value={apiHash} onChange={(e) => setApiHash(e.target.value)} placeholder="32 caractères" />
            </label>
            <p className="muted small">
              À créer une seule fois sur{' '}
              <a href="https://my.telegram.org" target="_blank" rel="noreferrer">
                my.telegram.org
              </a>{' '}
              → « API development tools ». Le guide détaillé est dans le README.
            </p>
          </>
        )}
        {step === 'phone' && (
          <input type="tel" autoComplete="tel" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="+33612345678" />
        )}
        {step === 'code' && (
          <input inputMode="numeric" autoComplete="one-time-code" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="12345" className="code" />
        )}
        {step === 'password' && (
          <input type="password" autoComplete="current-password" autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Mot de passe" />
        )}

        {error && <p className="error">{error}</p>}
        <button className="primary" disabled={busy}>
          {busy ? <span className="spinner dark" /> : c.button}
        </button>
        {step !== 'creds' && (
          <button type="button" className="link" onClick={restart}>
            Recommencer avec d’autres identifiants
          </button>
        )}
      </form>
      <p className="muted small center">Usage personnel · aucune donnée ne transite par un serveur tiers</p>
    </div>
  )
}
