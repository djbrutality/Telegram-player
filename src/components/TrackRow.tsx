import { memo } from 'react'
import { formatTime, trackArtist, trackTitle } from '../lib/format'
import type { Track } from '../lib/types'
import { Cover } from './Cover'

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
    <button className={`track-row${active ? ' active' : ''}`} onClick={onPlay}>
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
  )
})
