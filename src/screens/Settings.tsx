import { useState } from 'react'
import { Icon } from '../components/Icon'
import { wipeEverything } from '../lib/db'
import type { PlaybackMode } from '../lib/types'
import { streamAvailable } from '../player/stream'
import { audio } from '../player/player'
import { setPlaybackMode, useApp } from '../store'
import { logoutRemote } from '../tg/client'
import { reindexAll, stopIndexing } from '../tg/indexer'

const modes: { id: PlaybackMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'stream', label: 'Streaming' },
  { id: 'full', label: 'Complet' },
]

export function Settings({ onBack, onEditChats }: { onBack: () => void; onEditChats: () => void }) {
  const me = useApp((s) => s.me)
  const net = useApp((s) => s.net)
  const mode = useApp((s) => s.playbackMode)
  const chats = useApp((s) => s.chats)
  const [busy, setBusy] = useState(false)

  const logout = async () => {
    if (!confirm('Se déconnecter ? La session, l’index et tous les réglages seront effacés de ce téléphone.')) return
    setBusy(true)
    stopIndexing()
    audio.pause()
    await logoutRemote()
    await wipeEverything()
    try {
      for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister()
    } catch {
      /* rien */
    }
    location.reload()
  }

  const reindex = () => {
    if (confirm('Effacer l’index local et reparcourir tous les groupes ?')) void reindexAll()
  }

  return (
    <div className="scroll">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Retour">
          <Icon name="back" />
        </button>
        <h1>Réglages</h1>
      </header>

      <h2 className="section">Compte</h2>
      <div className="group">
        <div className="setting">
          <span>{me?.name ?? 'Compte Telegram'}</span>
          <span className="muted">{net === 'online' ? 'Connecté' : net === 'connecting' ? 'Connexion…' : 'Hors ligne'}</span>
        </div>
      </div>

      <h2 className="section">Bibliothèque</h2>
      <div className="group">
        <button className="setting" onClick={onEditChats}>
          <span>Groupes et canaux</span>
          <span className="muted">{chats.length} choisi{chats.length > 1 ? 's' : ''} ›</span>
        </button>
        <button className="setting" onClick={reindex}>
          <span>Tout réindexer</span>
        </button>
      </div>

      <h2 className="section">Lecture</h2>
      <div className="group">
        <div className="setting col">
          <span>Mode de lecture</span>
          <div className="segmented">
            {modes.map((m) => (
              <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setPlaybackMode(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          <span className="muted small">
            Auto : streaming, avec repli sur le téléchargement complet du morceau en cas d’échec. Streaming{' '}
            {streamAvailable() ? 'disponible ✓' : 'indisponible sur cet appareil (repli actif)'}.
          </span>
        </div>
      </div>

      <h2 className="section">Session</h2>
      <div className="group">
        <button className="setting danger" onClick={logout} disabled={busy}>
          <span>{busy ? 'Déconnexion…' : 'Se déconnecter et tout effacer'}</span>
        </button>
      </div>
      <p className="muted small center pad">Onde · étape 1</p>
    </div>
  )
}
