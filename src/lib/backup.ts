// Sauvegarde automatique dans les « Messages enregistrés » de Telegram :
// groupes choisis, favoris, playlists et corrections de métadonnées.
import { backend } from '../tg/backend'
import { frenchError } from '../tg/client'
import { create } from 'zustand'
import { getSelectedChats, setSelectedChats } from './db'
import type { ChatInfo } from './types'
import { onUserDataChange, replaceUserData, snapshot, type UserData } from './userdata'
import { useApp } from '../store'

const K_DIRTY = 'onde.backupDirty'
const K_LAST = 'onde.lastBackup'
const DELAY_MS = 20_000

export interface BackupFile extends UserData {
  app: 'onde'
  version: 1
  savedAt: number
  chats: ChatInfo[]
}

interface BackupState {
  status: 'idle' | 'saving' | 'error'
  error: string | null
  /** date (ms) de la dernière sauvegarde réussie depuis cet appareil */
  last: number | null
}
export const useBackup = create<BackupState>(() => ({
  status: 'idle',
  error: null,
  last: Number(localStorage.getItem(K_LAST)) || null,
}))

let timer: number | undefined
let running: Promise<boolean> | null = null

/** À appeler après chaque changement : la sauvegarde part 20 s plus tard. */
export function markDirty() {
  localStorage.setItem(K_DIRTY, '1')
  clearTimeout(timer)
  timer = window.setTimeout(() => void runBackup(), DELAY_MS)
}
onUserDataChange(markDirty)

export function hasPendingBackup() {
  return localStorage.getItem(K_DIRTY) === '1'
}

/** Envoie la sauvegarde maintenant. Renvoie true si elle a réussi. */
export function runBackup(): Promise<boolean> {
  running ??= (async () => {
    clearTimeout(timer)
    if (useApp.getState().net !== 'online') return false
    useBackup.setState({ status: 'saving', error: null })
    try {
      const file: BackupFile = { app: 'onde', version: 1, savedAt: Date.now(), chats: await getSelectedChats(), ...snapshot() }
      localStorage.removeItem(K_DIRTY)
      await (await backend()).saveBackup(JSON.stringify(file))
      localStorage.setItem(K_LAST, String(file.savedAt))
      useBackup.setState({ status: 'idle', last: file.savedAt })
      return true
    } catch (err) {
      localStorage.setItem(K_DIRTY, '1')
      useBackup.setState({ status: 'error', error: frenchError(err) })
      return false
    }
  })().finally(() => (running = null))
  return running
}

/** Cherche la dernière sauvegarde dans les Messages enregistrés. */
export async function findBackup(): Promise<BackupFile | null> {
  const found = await (await backend()).loadBackup()
  if (!found) return null
  try {
    const data = JSON.parse(found.json) as BackupFile
    if (data?.app !== 'onde' || !Array.isArray(data.chats)) return null
    data.savedAt ||= found.date * 1000
    return data
  } catch {
    return null
  }
}

/** Remplace les données locales par celles de la sauvegarde. */
export async function applyBackup(data: BackupFile) {
  const chats = data.chats.filter((c) => c && typeof c.id === 'string' && typeof c.title === 'string')
  await setSelectedChats(chats)
  replaceUserData(data)
  localStorage.removeItem(K_DIRTY)
  localStorage.setItem(K_LAST, String(data.savedAt))
  useBackup.setState({ last: data.savedAt, status: 'idle', error: null })
}
