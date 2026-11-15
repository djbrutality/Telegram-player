import { Icon } from '../components/Icon'
import { hueOf } from '../lib/format'
import { useApp, type ChatProgress } from '../store'

export function progressLabel(p: ChatProgress | undefined): string {
  if (!p) return 'En attente…'
  if (p.error) return p.error
  const n = `${p.count.toLocaleString('fr-FR')} morceau${p.count > 1 ? 'x' : ''}`
  if (p.complete && !p.busy) return n
  if (p.busy && !p.complete) return p.total > p.count ? `Indexation… ${p.count} / ${p.total}` : `Indexation… ${p.count}`
  if (p.busy) return `${n} · vérification…`
  return `${n} · indexation en attente`
}

export function Groups({ onOpen, onEdit }: { onOpen: (id: string) => void; onEdit: () => void }) {
  const chats = useApp((s) => s.chats)
  const progress = useApp((s) => s.progress)
  return (
    <div className="scroll">
      <header className="topbar">
        <h1>Groupes</h1>
        <button className="pill" onClick={onEdit}>
          Modifier
        </button>
      </header>
      <div className="list">
        {chats.map((c) => {
          const p = progress[c.id]
          const ratio = p && !p.complete && p.total > 0 ? p.count / p.total : null
          return (
            <button key={c.id} className="pick-row" onClick={() => onOpen(c.id)}>
              <span className="avatar" style={{ background: `hsl(${hueOf(c.title)} 42% 32%)` }}>
                {[...c.title.trim()][0]?.toUpperCase() ?? '?'}
              </span>
              <span className="track-text">
                <span className="track-title">{c.title}</span>
                <span className={`track-artist${p?.error ? ' err' : ''}`}>{progressLabel(p)}</span>
                {ratio !== null && (
                  <span className="bar">
                    <i style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </span>
                )}
              </span>
              <span className="muted">
                <Icon name="chevron" size={20} />
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
