import { useState } from 'react'
import { ChatAvatar } from '../components/ChatAvatar'
import { Icon } from '../components/Icon'
import { getChatKeys, getIndexState, getTrack } from '../lib/db'
import { chatKind } from '../lib/format'
import type { ChatInfo } from '../lib/types'
import { toast, useApp } from '../store'
import { backend } from '../tg/backend'

/** Compare ce que contient Onde et ce que répond Telegram pour un groupe (aide au dépannage). */
export function Diagnostic({ onBack }: { onBack: () => void }) {
  const chats = useApp((s) => s.chats)
  const [chat, setChat] = useState<ChatInfo | null>(null)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState('')

  const run = async () => {
    if (!chat) return
    setBusy(true)
    setReport('')
    const out: string[] = [`Groupe : ${chat.title} (${chatKind(chat)}, id ${chat.id})`]
    try {
      const keys = await getChatKeys(chat.id)
      const cut = chat.id.length + 1
      const ids = keys.map((k) => Number(k.slice(cut)))
      const state = await getIndexState(chat.id)
      const newest = keys.length ? await getTrack(keys[0]) : undefined
      const oldest = keys.length ? await getTrack(keys[keys.length - 1]) : undefined
      const date = (s?: number) => (s ? new Date(s * 1000).toISOString().slice(0, 10) : '?')
      out.push(`Onde : ${keys.length} morceaux, du #${ids[ids.length - 1] ?? 0} (${date(oldest?.date)}) au #${ids[0] ?? 0} (${date(newest?.date)})`)
      out.push(`État : terminé=${state?.complete} compte=${state?.count} total=${state?.total} plusAncien=${state?.oldestId} plusRécent=${state?.newestId}`)
      const remote = await (await backend()).diagnose(chat, query.trim(), { count: keys.length, oldestId: state?.oldestId ?? 0 })
      out.push(...remote.lines)
      if (remote.ids.length) {
        const known = new Set(ids)
        out.push(`Présents dans Onde : ${remote.ids.map((id) => `#${id}=${known.has(id) ? 'oui' : 'NON'}`).join(' ')}`)
      }
    } catch (err) {
      out.push(`ERREUR : ${(err as Error).message}`)
    }
    setReport(out.join('\n'))
    setBusy(false)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(report)
      toast('Rapport copié')
    } catch {
      toast('Copie impossible : faites une capture d’écran')
    }
  }

  return (
    <div className="scroll">
      <header className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="Retour">
          <Icon name="back" />
        </button>
        <h1>Diagnostic</h1>
      </header>
      <p className="muted pad">Choisissez un groupe, saisissez le titre d’un morceau introuvable, puis lancez la vérification.</p>
      <div className="list">
        {chats.map((c) => (
          <button key={c.id} className="pick-row" onClick={() => setChat(c)} aria-pressed={chat?.id === c.id}>
            <ChatAvatar chat={c} />
            <span className="track-text">
              <span className="track-title">{c.title}</span>
              <span className="track-artist">{chatKind(c)}</span>
            </span>
            <span className={`checkbox${chat?.id === c.id ? ' on' : ''}`}>{chat?.id === c.id && <Icon name="check" size={16} />}</span>
          </button>
        ))}
      </div>
      <div className="pad diag-form">
        <input placeholder="Titre du morceau (ex. This Mf Down)" value={query} onChange={(e) => setQuery(e.target.value)} autoCorrect="off" />
        <button className="primary" disabled={!chat || busy} onClick={run}>
          {busy ? <span className="spinner dark" /> : 'Lancer la vérification'}
        </button>
      </div>
      {report && (
        <div className="pad">
          <pre className="report">{report}</pre>
          <button className="secondary" onClick={copy}>
            Copier le rapport
          </button>
        </div>
      )}
    </div>
  )
}
