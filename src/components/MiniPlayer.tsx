import { trackArtist, trackTitle } from '../lib/format'
import { next, toggle, usePlayer } from '../player/player'
import { Cover } from './Cover'
import { Icon } from './Icon'

/** Barre de lecture fixe, au-dessus de la barre de navigation. */
export function MiniPlayer() {
  const { current, playing, loading, position, duration, error, dlProgress, index, queue } = usePlayer()
  if (!current) return null
  const ratio = duration > 0 ? Math.min(1, position / duration) : 0
  const sub = error
    ? error
    : dlProgress !== null
      ? `Téléchargement… ${Math.round(dlProgress * 100)} %`
      : trackArtist(current)
  return (
    <div className="mini">
      <div className="mini-progress">
        <div style={{ transform: `scaleX(${dlProgress ?? ratio})` }} className={dlProgress !== null ? 'dl' : ''} />
      </div>
      <Cover track={current} size={44} />
      <div className="mini-text">
        <span className="track-title">{trackTitle(current)}</span>
        <span className={`track-artist${error ? ' err' : ''}`}>{sub}</span>
      </div>
      <button className="icon-btn big" onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}>
        {loading && !error ? <span className="spinner" /> : <Icon name={playing ? 'pause' : 'play'} size={26} />}
      </button>
      <button className="icon-btn" onClick={next} disabled={index + 1 >= queue.length} aria-label="Suivant">
        <Icon name="next" />
      </button>
    </div>
  )
}
