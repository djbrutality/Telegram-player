import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { askNewPlaylist } from '../components/TrackMenu'
import { ROW_HEIGHT, TrackRow } from '../components/TrackRow'
import { VirtualList } from '../components/VirtualList'
import { formatBytes, hueOf } from '../lib/format'
import { clearOffline, keepOffline, useOffline } from '../lib/offline'
import { getTracksByKeys } from '../lib/db'
import { useTracksByKeys } from '../lib/library'
import type { Track } from '../lib/types'
import { deletePlaylist, renamePlaylist, useUser, type Playlist } from '../lib/userdata'
import { playList, usePlayer } from '../player/player'
import { toast, useUi } from '../store'

function TrackList({ keys, context, playlistId, empty }: { keys: string[]; context: string; playlistId?: string; empty: string }) {
  const tracks = useTracksByKeys(keys)
  const currentKey = usePlayer((s) => s.current?.key)
  const playing = usePlayer((s) => s.playing)
  if (!tracks) return null
  const missing = keys.length - tracks.length
  return (
    <>
      {keys.length === 0 && <p className="muted pad">{empty}</p>}
      {missing > 0 && (
        <p className="muted small pad">
          {missing} morceau{missing > 1 ? 'x' : ''} en attente : ils apparaîtront quand leur groupe sera indexé.
        </p>
      )}
      {tracks.length > 0 && (
        <VirtualList
          items={tracks}
          rowHeight={ROW_HEIGHT}
          render={(t: Track, i) => (
            <TrackRow
              key={t.key}
              track={t}
              active={t.key === currentKey}
              playing={playing}
              playlistId={playlistId}
              onPlay={() => playList(tracks, i, context)}
            />
          )}
        />
      )}
    </>
  )
}

/** Télécharge tous les morceaux d'une liste pour l'écoute hors ligne. */
async function keepAllOffline(keys: string[]) {
  const added = keepOffline(await getTracksByKeys(keys))
  toast(added ? `${added} morceau${added > 1 ? 'x' : ''} à télécharger` : 'Tout est déjà sur le téléphone')
}

function OfflineList() {
  const saved = useOffline((s) => s.saved)
  const current = useOffline((s) => s.current)
  const waiting = useOffline((s) => s.queue.length)
  const list = useMemo(() => Object.values(saved).sort((a, b) => b.at - a.at), [saved])
  const keys = useMemo(() => list.map((m) => m.key), [list])
  const bytes = list.reduce((n, m) => n + m.size, 0)
  const wipe = () => {
    if (confirm(`Retirer les ${list.length} morceaux gardés hors ligne ? Ils resteront disponibles en streaming.`)) void clearOffline()
  }
  return (
    <>
      <div className="pad offline-bar">
        <span className="muted small">
          {list.length} morceau{list.length > 1 ? 'x' : ''} · {formatBytes(bytes)}
          {current && ` · téléchargement ${Math.round(current.progress * 100)} %${waiting ? ` (+${waiting} en attente)` : ''}`}
        </span>
        {list.length > 0 && (
          <button className="pill" onClick={wipe}>
            Vider
          </button>
        )}
      </div>
      <TrackList
        keys={keys}
        context="Hors ligne"
        empty="Aucun morceau gardé hors ligne. Touchez « ⋯ » sur un morceau puis « Garder hors ligne », ou la flèche en haut d’une playlist."
      />
    </>
  )
}

function PlaylistView({ playlist, onBack }: { playlist: Playlist; onBack: () => void }) {
  const rename = () =>
    useUi.setState({
      dialog: {
        title: 'Renommer la playlist',
        fields: [{ label: 'Nom', value: playlist.name }],
        confirm: 'Renommer',
        onSubmit: ([name]) => name && renamePlaylist(playlist.id, name),
      },
    })
  const remove = () => {
    if (!confirm(`Supprimer la playlist « ${playlist.name} » ? Les morceaux restent dans vos groupes.`)) return
    deletePlaylist(playlist.id)
    onBack()
  }
  return (
    <div className="scroll">
      <header className="topbar sticky">
        <button className="icon-btn" onClick={onBack} aria-label="Retour">
          <Icon name="back" />
        </button>
        <div className="topbar-text">
          <h1 className="small">{playlist.name}</h1>
          <span className="track-artist">
            {playlist.keys.length} morceau{playlist.keys.length > 1 ? 'x' : ''}
          </span>
        </div>
        <button className="icon-btn" onClick={() => void keepAllOffline(playlist.keys)} aria-label="Garder la playlist hors ligne">
          <Icon name="download" size={22} />
        </button>
        <button className="icon-btn" onClick={rename} aria-label="Renommer">
          <Icon name="edit" size={21} />
        </button>
        <button className="icon-btn" onClick={remove} aria-label="Supprimer la playlist">
          <Icon name="trash" size={21} />
        </button>
      </header>
      <TrackList
        keys={playlist.keys}
        context={playlist.name}
        playlistId={playlist.id}
        empty="Playlist vide. Ajoutez des morceaux avec le bouton « ⋯ » d’un morceau, puis « Ajouter à une playlist »."
      />
    </div>
  )
}

/** Onglet Favoris : morceaux aimés et playlists personnelles. */
export function Favorites() {
  const favorites = useUser((s) => s.favorites)
  const playlists = useUser((s) => s.playlists)
  const [view, setView] = useState<'favs' | 'lists' | 'offline'>('favs')
  const [openId, setOpenId] = useState<string | null>(null)
  const favKeys = useMemo(() => favorites.map((f) => f.key), [favorites])
  const offlineCount = useOffline((s) => Object.keys(s.saved).length)

  const open = playlists.find((p) => p.id === openId)
  if (open) return <PlaylistView playlist={open} onBack={() => setOpenId(null)} />

  return (
    <div className="scroll">
      <header className="topbar">
        <h1>Favoris</h1>
      </header>
      <div className="pad">
        <div className="segmented">
          <button className={view === 'favs' ? 'on' : ''} onClick={() => setView('favs')}>
            Titres ({favorites.length})
          </button>
          <button className={view === 'lists' ? 'on' : ''} onClick={() => setView('lists')}>
            Playlists ({playlists.length})
          </button>
          <button className={view === 'offline' ? 'on' : ''} onClick={() => setView('offline')}>
            Hors ligne ({offlineCount})
          </button>
        </div>
      </div>
      {view === 'offline' ? (
        <OfflineList />
      ) : view === 'favs' ? (
        <>
          {favKeys.length > 0 && (
            <div className="pad offline-bar">
              <span className="muted small">Vos morceaux préférés</span>
              <button className="pill" onClick={() => void keepAllOffline(favKeys)}>
                Tout garder hors ligne
              </button>
            </div>
          )}
          <TrackList keys={favKeys} context="Favoris" empty="Aucun favori pour l’instant. Touchez le cœur dans le lecteur, ou « ⋯ » sur un morceau." />
        </>
      ) : (
        <div className="list">
          <button className="pick-row" onClick={() => askNewPlaylist()}>
            <span className="avatar add">
              <Icon name="plus" />
            </span>
            <span className="track-text">
              <span className="track-title">Nouvelle playlist</span>
            </span>
          </button>
          {playlists.map((p) => (
            <button key={p.id} className="pick-row" onClick={() => setOpenId(p.id)}>
              <span className="avatar" style={{ background: `hsl(${hueOf(p.id)} 42% 32%)` }}>
                <Icon name="list" size={22} />
              </span>
              <span className="track-text">
                <span className="track-title">{p.name}</span>
                <span className="track-artist">
                  {p.keys.length} morceau{p.keys.length > 1 ? 'x' : ''}
                </span>
              </span>
              <span className="muted">
                <Icon name="chevron" size={20} />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
