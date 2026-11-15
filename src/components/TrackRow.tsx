import { memo } from 'react'
import { formatTime, trackArtist, trackTitle } from '../lib/format'
import { useOffline } from '../lib/offline'
import type { Track } from '../lib/types'
import { useUser } from '../lib/userdata'
import { openMenu } from '../store'
import { Cover } from './Cover'
import { Icon } from './Icon'

export const ROW_HEIGHT = 64

export const TrackRow = memo(function TrackRow({
  track,
  active,
  playing,
  onPlay,
  playlistId,
}: {
  track: Track
  active: boolean
  playing: boolean
  onPlay: () => void
  playlistId?: string
}) {
  useUser((s) => s.metaVersion) // se réaffiche quand un titre est corrigé
  const favorite = useUser((s) => s.favorites.some((f) => f.key === track.key))
  const offline = useOffline((s) => track.key in s.saved)
  const downloading = useOffline((s) => s.current?.key === track.key || s.queue.some((t) => t.key === track.key))
  return (
    <div className={`track-row${active ? ' active' : ''}`}>
      <button className="track-main" onClick={onPlay}>
        <div className="track-cover">
          <Cover track={track} size={46} />
          {active && (
            <span className={`bars${playing ? ' on' : ''}`}>
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
        <span className="track-text">
          <span className="track-title">{trackTitle(track)}</span>
          <span className="track-artist">{trackArtist(track)}</span>
        </span>
        {downloading && <span className="spinner small" />}
        {offline && (
          <span className="off-mark" aria-label="Disponible hors ligne">
            <Icon name="download" size={14} />
          </span>
        )}
        {favorite && (
          <span className="fav-mark">
            <Icon name="heart-full" size={13} />
          </span>
        )}
        <span className="track-time">{track.duration ? formatTime(track.duration) : ''}</span>
      </button>
      <button className="icon-btn more" onClick={() => openMenu(track, playlistId ?? null)} aria-label="Plus d’actions">
        <Icon name="more" size={22} />
      </button>
    </div>
  )
})
