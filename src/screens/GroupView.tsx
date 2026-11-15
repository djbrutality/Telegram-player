import { Icon } from '../components/Icon'
import { ROW_HEIGHT, TrackRow } from '../components/TrackRow'
import { VirtualList } from '../components/VirtualList'
import { getTracksByKeys } from '../lib/db'
import { useChatKeys, useTrack } from '../lib/library'
import type { Track } from '../lib/types'
import { playLazy, QUEUE_WINDOW, usePlayer } from '../player/player'
import { useApp } from '../store'
import { progressLabel } from './Groups'

/** File d'attente construite autour du morceau touché : la suite du groupe, ou un tirage au sort. */
async function queueAround(keys: string[], i: number, first: Track, shuffle: boolean) {
  if (shuffle) {
    const picked = new Set<number>()
    const want = Math.min(QUEUE_WINDOW - 1, keys.length - 1)
    while (picked.size < want) {
      const n = Math.floor(Math.random() * keys.length)
      if (n !== i) picked.add(n)
    }
    const rest = await getTracksByKeys([...picked].map((n) => keys[n]))
    return { tracks: [first, ...rest], index: 0 }
  }
  const tracks = await getTracksByKeys(keys.slice(Math.max(0, i - 100), i + QUEUE_WINDOW))
  return { tracks, index: tracks.findIndex((t) => t.key === first.key) }
}

function Row({ k, i, keys, context }: { k: string; i: number; keys: string[]; context: string | null }) {
  const track = useTrack(k)
  const active = usePlayer((s) => s.current?.key === k)
  const playing = usePlayer((s) => s.playing)
  if (!track) {
    return (
      <div className="track-row skeleton">
        <div className="track-main">
          <div className="cover-ph" />
          <span className="track-text">
            <span className="line" />
            <span className="line short" />
          </span>
        </div>
      </div>
    )
  }
  return (
    <TrackRow
      track={track}
      active={active}
      playing={active && playing}
      onPlay={() => playLazy(track, context, (shuffle) => queueAround(keys, i, track, shuffle))}
    />
  )
}

export function GroupView({ chatId, onBack }: { chatId: string; onBack: () => void }) {
  const chat = useApp((s) => s.chats.find((c) => c.id === chatId))
  const progress = useApp((s) => s.progress[chatId])
  const keys = useChatKeys(chatId)

  return (
    <div className="scroll">
      <header className="topbar sticky">
        <button className="icon-btn" onClick={onBack} aria-label="Retour">
          <Icon name="back" />
        </button>
        <div className="topbar-text">
          <h1 className="small">{chat?.title ?? 'Groupe'}</h1>
          <span className={`track-artist${progress?.error ? ' err' : ''}`}>{progressLabel(progress)}</span>
        </div>
      </header>
      {keys && keys.length === 0 && (
        <p className="muted pad">
          {progress?.complete ? 'Aucun fichier audio dans ce groupe.' : 'Indexation en cours, les morceaux arrivent…'}
        </p>
      )}
      {keys && keys.length > 0 && (
        <VirtualList
          items={keys}
          rowHeight={ROW_HEIGHT}
          render={(k, i) => <Row key={k} k={k} i={i} keys={keys} context={chat?.title ?? null} />}
        />
      )}
    </div>
  )
}
