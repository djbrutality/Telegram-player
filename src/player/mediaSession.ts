// Écran verrouillé et centre de contrôle : titre, pochette et commandes (Media Session API).
import { coverBlob } from '../lib/covers'
import { trackArtist, trackTitle } from '../lib/format'
import type { Track } from '../lib/types'
import { audio, next, prev, seek, toggle, usePlayer } from './player'

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

const fallbackArt = () => [{ src: new URL('icons/icon-512.png', document.baseURI).href, sizes: '512x512', type: 'image/png' }]

async function showTrack(track: Track, context: string | null) {
  const base = { title: trackTitle(track), artist: trackArtist(track), album: context ?? 'Onde' }
  navigator.mediaSession.metadata = new MediaMetadata({ ...base, artwork: fallbackArt() })
  try {
    const blob = await coverBlob(track)
    if (!blob || usePlayer.getState().current?.key !== track.key) return
    const src = await toDataUrl(blob)
    navigator.mediaSession.metadata = new MediaMetadata({ ...base, artwork: [{ src, sizes: '320x320', type: blob.type || 'image/jpeg' }] })
  } catch {
    /* pas de pochette : on garde l'icône de l'appli */
  }
}

function updatePosition() {
  const { duration, position } = usePlayer.getState()
  if (!duration || !isFinite(duration)) return
  try {
    navigator.mediaSession.setPositionState({ duration, position: Math.min(position, duration), playbackRate: 1 })
  } catch {
    /* valeurs transitoires incohérentes : ignoré */
  }
}

export function initMediaSession() {
  if (!('mediaSession' in navigator)) return
  const ms = navigator.mediaSession
  ms.setActionHandler('play', () => toggle())
  ms.setActionHandler('pause', () => audio.pause())
  ms.setActionHandler('previoustrack', () => prev())
  ms.setActionHandler('nexttrack', () => next())
  ms.setActionHandler('seekto', (e) => e.seekTime != null && seek(e.seekTime))
  // Pas de « seekbackward / seekforward » : sur iOS ils remplaceraient les boutons précédent/suivant.

  let lastPos = 0
  usePlayer.subscribe((s, old) => {
    if (s.current && (s.current !== old.current || s.context !== old.context)) void showTrack(s.current, s.context)
    if (s.playing !== old.playing) ms.playbackState = s.playing ? 'playing' : 'paused'
    const now = Date.now()
    if (s.duration !== old.duration || s.playing !== old.playing || Math.abs(s.position - old.position) > 2 || now - lastPos > 5000) {
      lastPos = now
      updatePosition()
    }
  })
  const { current, context } = usePlayer.getState()
  if (current) void showTrack(current, context)
}
