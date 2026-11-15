// État global de l'application (hors lecteur audio).
import { create } from 'zustand'
import type { ChatInfo, PlaybackMode, Track } from './lib/types'

export interface ChatProgress {
  count: number
  total: number
  complete: boolean
  busy: boolean
  error?: string
}

interface AppState {
  phase: 'boot' | 'login' | 'pick' | 'main'
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
/** Signale (au plus une fois par seconde) que la bibliothèque a changé. */
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
  }, 1000)
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
  /** court message affiché en bas de l'écran */
  toast: string | null
}
export const useUi = create<UiState>(() => ({ playerOpen: false, menuTrack: null, toast: null }))

let toastTimer: number | undefined
export function toast(message: string) {
  clearTimeout(toastTimer)
  useUi.setState({ toast: message })
  toastTimer = window.setTimeout(() => useUi.setState({ toast: null }), 2200)
}
