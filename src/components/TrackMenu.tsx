import { trackArtist, trackTitle } from '../lib/format'
import { addToQueue, playNext } from '../player/player'
import { toast, useUi } from '../store'
import { Cover } from './Cover'
import { Icon } from './Icon'

/** Menu d'actions d'un morceau (bouton « ⋯ »). */
export function TrackMenu() {
  const track = useUi((s) => s.menuTrack)
  if (!track) return null
  const close = () => useUi.setState({ menuTrack: null })
  const run = (fn: () => void, message: string) => () => {
    fn()
    close()
    toast(message)
  }
  return (
    <div className="sheet-backdrop" onClick={close}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <Cover track={track} size={48} />
          <span className="track-text">
            <span className="track-title">{trackTitle(track)}</span>
            <span className="track-artist">{trackArtist(track)}</span>
          </span>
        </div>
        <button className="sheet-item" onClick={run(() => playNext(track), 'Sera lu juste après')}>
          <Icon name="playnext" /> Lire ensuite
        </button>
        <button className="sheet-item" onClick={run(() => addToQueue(track), 'Ajouté à la file d’attente')}>
          <Icon name="plus" /> Ajouter à la file d’attente
        </button>
        <button className="sheet-item cancel" onClick={close}>
          Annuler
        </button>
      </div>
    </div>
  )
}
