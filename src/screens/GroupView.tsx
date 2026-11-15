import { Icon } from '../components/Icon'
import { ROW_HEIGHT, TrackRow } from '../components/TrackRow'
import { VirtualList } from '../components/VirtualList'
import { useChatTracks } from '../lib/library'
import { playList, usePlayer } from '../player/player'
import { useApp } from '../store'
import { progressLabel } from './Groups'

export function GroupView({ chatId, onBack }: { chatId: string; onBack: () => void }) {
  const chat = useApp((s) => s.chats.find((c) => c.id === chatId))
  const progress = useApp((s) => s.progress[chatId])
  const tracks = useChatTracks(chatId)
  const currentKey = usePlayer((s) => s.current?.key)
  const playing = usePlayer((s) => s.playing)

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
      {tracks && tracks.length === 0 && (
        <p className="muted pad">
          {progress?.complete ? 'Aucun fichier audio dans ce groupe.' : 'Indexation en cours, les morceaux arrivent…'}
        </p>
      )}
      {tracks && tracks.length > 0 && (
        <VirtualList
          items={tracks}
          rowHeight={ROW_HEIGHT}
          render={(t, i) => (
            <TrackRow key={t.key} track={t} active={t.key === currentKey} playing={playing} onPlay={() => playList(tracks, i)} />
          )}
        />
      )}
    </div>
  )
}
