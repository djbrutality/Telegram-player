import { useEffect, useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { chatKind, fold, hueOf } from '../lib/format'
import type { ChatInfo } from '../lib/types'
import { useApp } from '../store'
import { backend } from '../tg/backend'
import { frenchError } from '../tg/client'

/** Choix des groupes et canaux qui servent de bibliothèque. */
export function ChatPicker({ onDone, onCancel }: { onDone: (chats: ChatInfo[]) => void; onCancel?: () => void }) {
  const current = useApp((s) => s.chats)
  const [all, setAll] = useState<ChatInfo[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(current.map((c) => c.id)))
  const [filter, setFilter] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let alive = true
    setError(null)
    backend()
      .then((b) => b.listChats())
      .then(
        (list) => alive && setAll(list),
        (err) => alive && setError(frenchError(err)),
      )
    return () => {
      alive = false
    }
  }, [attempt])

  const shown = useMemo(() => {
    const q = fold(filter)
    return (all ?? []).filter((c) => !q || fold(`${c.title} ${c.username ?? ''}`).includes(q))
  }, [all, filter])

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (!n.delete(id)) n.add(id)
      return n
    })

  const confirm = () => onDone((all ?? []).filter((c) => selected.has(c.id)))

  return (
    <div className="page">
      <div className="scroll">
        <header className="topbar">
          {onCancel && (
            <button className="icon-btn" onClick={onCancel} aria-label="Retour">
              <Icon name="back" />
            </button>
          )}
          <h1>Ma bibliothèque</h1>
        </header>
        <p className="muted pad">Cochez les groupes et canaux dont vous voulez écouter la musique. Seuls ceux-là seront parcourus.</p>
        <div className="pad">
          <input type="search" placeholder="Filtrer…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        {error && (
          <div className="pad">
            <p className="error">{error}</p>
            <button className="secondary" onClick={() => setAttempt((a) => a + 1)}>
              Réessayer
            </button>
          </div>
        )}
        {!all && !error && (
          <div className="center-block">
            <span className="spinner" />
            <p className="muted">Chargement de vos groupes…</p>
          </div>
        )}
        {all && shown.length === 0 && <p className="muted pad">Aucun groupe ou canal trouvé.</p>}
        <div className="list">
          {shown.map((c) => {
            const on = selected.has(c.id)
            return (
              <button key={c.id} className="pick-row" onClick={() => toggle(c.id)} aria-pressed={on}>
                <span className="avatar" style={{ background: `hsl(${hueOf(c.title)} 42% 32%)` }}>
                  {[...c.title.trim()][0]?.toUpperCase() ?? '?'}
                </span>
                <span className="track-text">
                  <span className="track-title">{c.title}</span>
                  <span className="track-artist">{chatKind(c)}</span>
                </span>
                <span className={`checkbox${on ? ' on' : ''}`}>{on && <Icon name="check" size={16} />}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="footer-action">
        <button className="primary" disabled={!all || selected.size === 0} onClick={confirm}>
          {selected.size === 0 ? 'Choisissez au moins un groupe' : `Valider (${selected.size})`}
        </button>
      </div>
    </div>
  )
}
