// État global de l'application (hors lecteur audio).
import { create } from 'zustand'
import type { ChatInfo, PlaybackMode, Track } from './lib/types'

export interface ChatProgress {
  count: number
  total: number
  complete: boolean
  busy: boolean
  /** relecture de l'historique ancien en cours */
  deep?: boolean
  error?: string
}

interface AppState {
  phase: 'boot' | 'login' | 'restore' | 'pick' | 'main'
  loginNotice: string | null
  me: { name: string } | null
  /** 'connecting' | 'online' | 'offline' */
  net: 'connecting' | 'online' | 'offline'
  chats: ChatInfo[]
  progress: Record<string, ChatProgress>
  /** augmente à chaque fois que la bibliothèque locale change */
  libVersion: number
  /** horodatage (ms) de fin de la pause imposée par Telegram, ou 0 */
  floodUntil: number
  playbackMode: PlaybackMode
}

export const useApp = create<AppState>(() => ({
  phase: 'boot',
  loginNotice: null,
  me: null,
  net: 'connecting',
  chats: [],
  progress: {},
  libVersion: 0,
  floodUntil: 0,
  playbackMode: (localStorage.getItem('onde.playbackMode') as PlaybackMode) || 'auto',
}))

export function setProgress(chatId: string, patch: Partial<ChatProgress>) {
  useApp.setState((s) => {
    const previous: ChatProgress = s.progress[chatId] ?? { count: 0, total: 0, complete: false, busy: false }
    return { progress: { ...s.progress, [chatId]: { ...previous, ...patch } } }
  })
}

let bumpTimer: number | undefined
/** Signale (au plus toutes les 2,5 s) que la bibliothèque a changé. */
export function bumpLibrary(now = false) {
  if (now) {
    clearTimeout(bumpTimer)
    bumpTimer = undefined
    useApp.setState((s) => ({ libVersion: s.libVersion + 1 }))
    return
  }
  bumpTimer ??= window.setTimeout(() => {
    bumpTimer = undefined
    useApp.setState((s) => ({ libVersion: s.libVersion + 1 }))
  }, 2500)
}

export function setPlaybackMode(mode: PlaybackMode) {
  localStorage.setItem('onde.playbackMode', mode)
  useApp.setState({ playbackMode: mode })
}

// --- Petits états d'interface ---
interface UiState {
  /** lecteur plein écran ouvert ? */
  playerOpen: boolean
  /** morceau dont le menu d'actions est affiché */
  menuTrack: Track | null
  /** playlist depuis laquelle le menu a été ouvert (pour « Retirer de la playlist ») */
  menuPlaylist: string | null
  /** petite fenêtre de saisie */
  dialog: DialogSpec | null
  /** court message affiché en bas de l'écran */
  toast: string | null
}
export interface DialogSpec {
  title: string
  fields: { label: string; value: string; placeholder?: string }[]
  confirm: string
  onSubmit: (values: string[]) => void
}
export const useUi = create<UiState>(() => ({ playerOpen: false, menuTrack: null, menuPlaylist: null, dialog: null, toast: null }))

export function openMenu(track: Track, playlistId: string | null = null) {
  useUi.setState({ menuTrack: track, menuPlaylist: playlistId })
}

let toastTimer: number | undefined
export function toast(message: string) {
  clearTimeout(toastTimer)
  useUi.setState({ toast: message })
  toastTimer = window.setTimeout(() => useUi.setState({ toast: null }), 2200)
}
