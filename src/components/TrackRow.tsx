import { memo } from 'react'
import { formatTime, trackArtist, trackTitle } from '../lib/format'
import type { Track } from '../lib/types'
import { useUi } from '../store'
import { Cover } from './Cover'
import { Icon } from './Icon'

export const ROW_HEIGHT = 64

export const TrackRow = memo(function TrackRow({
  track,
  active,
  playing,
  onPlay,
}: {
  track: Track
  active: boolean
  playing: boolean
  onPlay: () => void
}) {
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
        <span className="track-time">{track.duration ? formatTime(track.duration) : ''}</span>
      </button>
      <button className="icon-btn more" onClick={() => useUi.setState({ menuTrack: track })} aria-label="Plus d’actions">
        <Icon name="more" size={22} />
      </button>
    </div>
  )
})
