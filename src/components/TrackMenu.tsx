import { useEffect, useState } from 'react'
import { trackArtist, trackTitle } from '../lib/format'
import { keepOffline, removeOffline, useOffline } from '../lib/offline'
import { updateSearchEntry } from '../lib/searchIndex'
import type { Track } from '../lib/types'
import { addToPlaylist, createPlaylist, getOverride, removeFromPlaylist, setOverride, toggleFavorite, useUser } from '../lib/userdata'
import { addToQueue, playNext } from '../player/player'
import { bumpLibrary, toast, useUi } from '../store'
import { Cover } from './Cover'
import { Icon } from './Icon'

export function askNewPlaylist(firstTrack?: Track) {
  useUi.setState({
    dialog: {
      title: 'Nouvelle playlist',
      fields: [{ label: 'Nom', value: '', placeholder: 'Ma playlist' }],
      confirm: 'Créer',
      onSubmit: ([name]) => {
        if (!name) return
        createPlaylist(name, firstTrack?.key)
        toast(firstTrack ? `Ajouté à « ${name} »` : 'Playlist créée')
      },
    },
  })
}

export function askEditMeta(track: Track) {
  const fixed = getOverride(track.key)
  useUi.setState({
    dialog: {
      title: 'Corriger le morceau',
      fields: [
        { label: 'Titre', value: fixed?.title ?? track.title ?? '', placeholder: trackTitle(track) },
        { label: 'Artiste', value: fixed?.performer ?? track.performer ?? '', placeholder: 'Artiste inconnu' },
      ],
      confirm: 'Enregistrer',
      onSubmit: ([title, performer]) => {
        // On ne garde une correction que si elle diffère de ce que Telegram fournit.
        setOverride(track.key, {
          title: title && title !== (track.title ?? '') ? title : undefined,
          performer: performer && performer !== (track.performer ?? '') ? performer : undefined,
        })
        updateSearchEntry(track)
        bumpLibrary(true)
        toast('Morceau corrigé')
      },
    },
  })
}

/** Menu d'actions d'un morceau (bouton « ⋯ »). */
export function TrackMenu() {
  const track = useUi((s) => s.menuTrack)
  const playlistId = useUi((s) => s.menuPlaylist)
  const favorite = useUser((s) => !!track && s.favorites.some((f) => f.key === track.key))
  const playlists = useUser((s) => s.playlists)
  const offline = useOffline((s) => !!track && track.key in s.saved)
  const [choosing, setChoosing] = useState(false)
  useEffect(() => setChoosing(false), [track])
  if (!track) return null

  const close = () => useUi.setState({ menuTrack: null, menuPlaylist: null })
  const run = (fn: () => void, message?: string) => () => {
    fn()
    close()
    if (message) toast(message)
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

        {choosing ? (
          <div className="sheet-scroll">
            <button className="sheet-item" onClick={run(() => askNewPlaylist(track))}>
              <Icon name="plus" /> Nouvelle playlist
            </button>
            {playlists.map((p) => (
              <button
                key={p.id}
                className="sheet-item"
                onClick={run(
                  () => toast(addToPlaylist(p.id, track.key) ? `Ajouté à « ${p.name} »` : `Déjà dans « ${p.name} »`),
                )}
              >
                <Icon name="list" />
                <span className="track-text">
                  <span className="track-title">{p.name}</span>
                  <span className="track-artist">
                    {p.keys.length} morceau{p.keys.length > 1 ? 'x' : ''}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <button className="sheet-item" onClick={run(() => playNext(track), 'Sera lu juste après')}>
              <Icon name="playnext" /> Lire ensuite
            </button>
            <button className="sheet-item" onClick={run(() => addToQueue(track), 'Ajouté à la file d’attente')}>
              <Icon name="plus" /> Ajouter à la file d’attente
            </button>
            <button
              className="sheet-item"
              onClick={run(() => void toggleFavorite(track.key), favorite ? 'Retiré des favoris' : 'Ajouté aux favoris')}
            >
              <Icon name={favorite ? 'heart-full' : 'heart'} /> {favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            </button>
            <button className="sheet-item" onClick={() => setChoosing(true)}>
              <Icon name="list" /> Ajouter à une playlist…
            </button>
            {offline ? (
              <button className="sheet-item" onClick={run(() => void removeOffline(track.key), 'Retiré du téléphone')}>
                <Icon name="close" /> Retirer du hors-ligne
              </button>
            ) : (
              <button className="sheet-item" onClick={run(() => void keepOffline([track]), 'Téléchargement pour le hors-ligne…')}>
                <Icon name="download" /> Garder hors ligne
              </button>
            )}
            {playlistId && (
              <button className="sheet-item" onClick={run(() => removeFromPlaylist(playlistId, track.key), 'Retiré de la playlist')}>
                <Icon name="close" /> Retirer de cette playlist
              </button>
            )}
            <button className="sheet-item" onClick={run(() => askEditMeta(track))}>
              <Icon name="edit" /> Corriger le titre et l’artiste
            </button>
          </>
        )}
        <button className="sheet-item cancel" onClick={close}>
          Annuler
        </button>
      </div>
    </div>
  )
}
