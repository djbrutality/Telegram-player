import { Icon } from '../components/Icon'
import { TrackRow } from '../components/TrackRow'
import { useRecentTracks } from '../lib/library'
import { playList, usePlayer } from '../player/player'
import { useApp } from '../store'

export function Home({ onSettings, onGroups }: { onSettings: () => void; onGroups: () => void }) {
  const chats = useApp((s) => s.chats)
  const progress = useApp((s) => s.progress)
  const recent = useRecentTracks(30)
  const currentKey = usePlayer((s) => s.current?.key)
  const playing = usePlayer((s) => s.playing)

  const total = chats.reduce((n, c) => n + (progress[c.id]?.count ?? 0), 0)
  const busy = chats.filter((c) => progress[c.id]?.busy || !progress[c.id]?.complete).length
  const hour = new Date().getHours()

  return (
    <div className="scroll">
      <header className="topbar">
        <h1>{hour < 5 || hour >= 18 ? 'Bonsoir' : 'Bonjour'}</h1>
        <button className="icon-btn" onClick={onSettings} aria-label="Réglages">
          <Icon name="settings" />
        </button>
      </header>

      <button className="hero" onClick={onGroups}>
        <span className="hero-number">{total.toLocaleString('fr-FR')}</span>
        <span className="hero-label">
          morceau{total > 1 ? 'x' : ''} dans {chats.length} groupe{chats.length > 1 ? 's' : ''}
        </span>
        {busy > 0 && (
          <span className="hero-status">
            <span className="spinner small" /> Indexation en cours…
          </span>
        )}
      </button>

      <h2 className="section">Derniers ajouts</h2>
      {recent && recent.length === 0 && (
        <p className="muted pad">{busy > 0 ? 'Les morceaux apparaîtront ici au fil de l’indexation.' : 'Aucun fichier audio trouvé dans vos groupes.'}</p>
      )}
      <div className="list">
        {recent?.map((t, i) => (
          <TrackRow key={t.key} track={t} active={t.key === currentKey} playing={playing} onPlay={() => playList(recent, i, 'Derniers ajouts')} />
        ))}
      </div>
    </div>
  )
}
