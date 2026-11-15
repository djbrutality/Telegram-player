import { trackArtist, trackTitle } from '../lib/format'
import { next, toggle, usePlayer } from '../player/player'
import { useUser } from '../lib/userdata'
import { useUi } from '../store'
import { Cover } from './Cover'
import { Icon } from './Icon'

/** Barre de lecture fixe, au-dessus de la barre de navigation. Un toucher ouvre le lecteur complet. */
export function MiniPlayer() {
  useUser((s) => s.metaVersion)
  const current = usePlayer((s) => s.current)
  const playing = usePlayer((s) => s.playing)
  const loading = usePlayer((s) => s.loading)
  const error = usePlayer((s) => s.error)
  const dlProgress = usePlayer((s) => s.dlProgress)
  const ratio = usePlayer((s) => (s.duration > 0 ? Math.min(1, s.position / s.duration) : 0))
  if (!current) return null
  const sub = error ? error : dlProgress !== null ? `Téléchargement… ${Math.round(dlProgress * 100)} %` : trackArtist(current)
  return (
    <div className="mini">
      <div className="mini-progress">
        <div style={{ transform: `scaleX(${dlProgress ?? ratio})` }} className={dlProgress !== null ? 'dl' : ''} />
      </div>
      <button className="mini-open" onClick={() => useUi.setState({ playerOpen: true })} aria-label="Ouvrir le lecteur">
        <Cover track={current} size={44} />
        <span className="mini-text">
          <span className="track-title">{trackTitle(current)}</span>
          <span className={`track-artist${error ? ' err' : ''}`}>{sub}</span>
        </span>
      </button>
      <button className="icon-btn big" onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}>
        {loading && !error ? <span className="spinner" /> : <Icon name={playing ? 'pause' : 'play'} size={26} />}
      </button>
      <button className="icon-btn" onClick={() => next()} aria-label="Suivant">
        <Icon name="skip-next" size={26} />
      </button>
    </div>
  )
}
