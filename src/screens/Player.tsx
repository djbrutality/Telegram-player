import { useEffect, useRef, useState } from 'react'
import { Cover } from '../components/Cover'
import { Icon } from '../components/Icon'
import { VirtualList } from '../components/VirtualList'
import { formatTime, trackArtist, trackTitle } from '../lib/format'
import { cycleRepeat, jumpTo, next, prev, removeFromQueue, seek, toggle, toggleShuffle, usePlayer } from '../player/player'
import { toggleFavorite, useUser } from '../lib/userdata'
import { openMenu, useUi } from '../store'

/** Barre de progression : on déplace le curseur librement, la lecture ne saute qu'au relâchement. */
function SeekBar() {
  const position = usePlayer((s) => s.position)
  const duration = usePlayer((s) => s.duration)
  const [drag, setDrag] = useState<number | null>(null)
  const max = duration > 0 ? duration : 1
  const value = Math.min(drag ?? position, max)
  const commit = () => {
    if (drag !== null) {
      seek(drag)
      setDrag(null)
    }
  }
  return (
    <div className="seek">
      <input
        type="range"
        min={0}
        max={max}
        step={0.5}
        value={value}
        style={{ '--fill': `${(value / max) * 100}%` } as React.CSSProperties}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={commit}
        onTouchEnd={commit}
        onKeyUp={commit}
        onBlur={commit}
        aria-label="Position dans le morceau"
      />
      <div className="seek-times">
        <span>{formatTime(value)}</span>
        <span>{duration > 0 ? formatTime(duration) : '--:--'}</span>
      </div>
    </div>
  )
}

function Queue() {
  useUser((s) => s.metaVersion)
  const queue = usePlayer((s) => s.queue)
  const index = usePlayer((s) => s.index)
  const scroller = useRef<HTMLDivElement>(null)

  // À l'ouverture, on se place sur le morceau en cours.
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = Math.max(0, index - 1) * 60
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="scroll queue" ref={scroller}>
      <VirtualList
        items={queue}
        rowHeight={60}
        render={(t, i) => (
          <div key={`${t.key}:${i}`} className={`queue-row${i === index ? ' active' : ''}${i < index ? ' past' : ''}`}>
            <button className="track-main" onClick={() => jumpTo(i)}>
              <Cover track={t} size={42} />
              <span className="track-text">
                <span className="track-title">{trackTitle(t)}</span>
                <span className="track-artist">{trackArtist(t)}</span>
              </span>
            </button>
            {i !== index && (
              <button className="icon-btn more" onClick={() => removeFromQueue(i)} aria-label="Retirer de la file">
                <Icon name="close" size={18} />
              </button>
            )}
          </div>
        )}
      />
    </div>
  )
}

/** Lecteur plein écran. */
export function Player() {
  const open = useUi((s) => s.playerOpen)
  const current = usePlayer((s) => s.current)
  const context = usePlayer((s) => s.context)
  const playing = usePlayer((s) => s.playing)
  const loading = usePlayer((s) => s.loading)
  const error = usePlayer((s) => s.error)
  const dlProgress = usePlayer((s) => s.dlProgress)
  const shuffle = usePlayer((s) => s.shuffle)
  const repeat = usePlayer((s) => s.repeat)
  const queueLength = usePlayer((s) => s.queue.length)
  const index = usePlayer((s) => s.index)
  useUser((s) => s.metaVersion)
  const favorite = useUser((s) => !!current && s.favorites.some((f) => f.key === current.key))
  const [showQueue, setShowQueue] = useState(false)
  const [coverSize, setCoverSize] = useState(300)
  const touchStart = useRef<number | null>(null)

  useEffect(() => {
    const fit = () => setCoverSize(Math.round(Math.min(window.innerWidth - 56, window.innerHeight * 0.42, 420)))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  useEffect(() => {
    if (!open) setShowQueue(false)
  }, [open])

  if (!current) return null
  const close = () => useUi.setState({ playerOpen: false })
  const status = error ?? (dlProgress !== null ? `Téléchargement… ${Math.round(dlProgress * 100)} %` : null)

  return (
    <div className={`player${open ? ' open' : ''}`} aria-hidden={!open}>
      <header
        className="player-top"
        onTouchStart={(e) => (touchStart.current = e.touches[0].clientY)}
        onTouchEnd={(e) => {
          if (touchStart.current !== null && e.changedTouches[0].clientY - touchStart.current > 60) close()
          touchStart.current = null
        }}
      >
        <button className="icon-btn" onClick={close} aria-label="Fermer le lecteur">
          <Icon name="down" size={28} />
        </button>
        <div className="player-context">
          <span className="muted small">{showQueue ? 'File d’attente' : 'Lecture depuis'}</span>
          <span className="track-title">{showQueue ? `${index + 1} / ${queueLength}` : (context ?? 'Onde')}</span>
        </div>
        <button className={`icon-btn${showQueue ? ' toggled' : ''}`} onClick={() => setShowQueue((v) => !v)} aria-label="File d’attente">
          <Icon name="queue" />
        </button>
      </header>

      {showQueue ? (
        open && <Queue />
      ) : (
        <div className="player-art">
          <div className={`art-wrap${playing ? ' on' : ''}`}>
            <Cover track={current} size={coverSize} />
          </div>
        </div>
      )}

      <div className="player-bottom">
        <div className="player-head">
          <div className="player-titles">
            <span className="player-title">{trackTitle(current)}</span>
            <span className={`player-artist${error ? ' err' : ''}`}>{status ?? trackArtist(current)}</span>
          </div>
          <button
            className={`icon-btn${favorite ? ' toggled' : ''}`}
            onClick={() => toggleFavorite(current.key)}
            aria-label={favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            aria-pressed={favorite}
          >
            <Icon name={favorite ? 'heart-full' : 'heart'} size={27} />
          </button>
          <button className="icon-btn" onClick={() => openMenu(current)} aria-label="Plus d’actions">
            <Icon name="more" />
          </button>
        </div>
        <SeekBar />
        <div className="controls">
          <button className={`icon-btn${shuffle ? ' toggled' : ''}`} onClick={toggleShuffle} aria-label="Lecture aléatoire" aria-pressed={shuffle}>
            <Icon name="shuffle" />
          </button>
          <button className="icon-btn large" onClick={prev} aria-label="Précédent">
            <Icon name="skip-prev" size={34} />
          </button>
          <button className="play-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Lecture'}>
            {loading && !error ? <span className="spinner dark" /> : <Icon name={playing ? 'pause' : 'play'} size={34} />}
          </button>
          <button className="icon-btn large" onClick={() => next()} aria-label="Suivant">
            <Icon name="skip-next" size={34} />
          </button>
          <button
            className={`icon-btn${repeat !== 'off' ? ' toggled' : ''}`}
            onClick={cycleRepeat}
            aria-label={repeat === 'off' ? 'Répétition désactivée' : repeat === 'all' ? 'Répéter la file' : 'Répéter ce morceau'}
          >
            <Icon name="repeat" />
            {repeat === 'one' && <span className="badge">1</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
