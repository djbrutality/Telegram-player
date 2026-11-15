import { useEffect, useState } from 'react'
import { findBackup, type BackupFile } from '../lib/backup'

/** Après une connexion sur un appareil vide : propose de reprendre la dernière sauvegarde. */
export function Restore({ onRestore, onSkip }: { onRestore: (b: BackupFile) => void; onSkip: () => void }) {
  const [backup, setBackup] = useState<BackupFile | null>(null)

  useEffect(() => {
    let alive = true
    findBackup().then(
      (b) => alive && (b ? setBackup(b) : onSkip()),
      () => alive && onSkip(),
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!backup) {
    return (
      <div className="center-block full">
        <span className="spinner" />
        <p className="muted">Recherche d’une sauvegarde…</p>
      </div>
    )
  }
  const n = (count: number, one: string, many: string) => `${count} ${count > 1 ? many : one}`
  return (
    <div className="scroll login">
      <h1 className="brand">Sauvegarde trouvée</h1>
      <div className="card">
        <p className="muted">
          Une sauvegarde du {new Date(backup.savedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} est
          présente dans vos Messages enregistrés :
        </p>
        <ul className="summary">
          <li>{n(backup.chats.length, 'groupe choisi', 'groupes choisis')}</li>
          <li>{n(backup.favorites?.length ?? 0, 'favori', 'favoris')}</li>
          <li>{n(backup.playlists?.length ?? 0, 'playlist', 'playlists')}</li>
          <li>{n(Object.keys(backup.overrides ?? {}).length, 'morceau corrigé', 'morceaux corrigés')}</li>
        </ul>
        <button className="primary" onClick={() => onRestore(backup)}>
          Restaurer
        </button>
        <button className="link" onClick={onSkip}>
          Commencer sans restaurer
        </button>
      </div>
    </div>
  )
}
