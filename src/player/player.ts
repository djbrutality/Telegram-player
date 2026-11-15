// Le lecteur : un seul élément <audio> pour toute l'appli.
import { create } from 'zustand'
import type { Track } from '../lib/types'
import { useApp } from '../store'
import { frenchError } from '../tg/client'
import { downloadFull, protect, registerTrack, streamAvailable, streamUrl } from './stream'

interface PlayerState {
  queue: Track[]
  index: number
  current: Track | null
  playing: boolean
  loading: boolean
  position: number
  duration: number
  error: string | null
  /** comment le morceau en cours est lu */
  source: 'stream' | 'full' | null
  /** avancement (0-1) du téléchargement complet, sinon null */
  dlProgress: number | null
}

export const usePlayer = create<PlayerState>(() => ({
  queue: [],
  index: -1,
  current: null,
  playing: false,
  loading: false,
  position: 0,
  duration: 0,
  error: null,
  source: null,
  dlProgress: null,
}))

const set = usePlayer.setState
const get = usePlayer.getState

export const audio = new Audio()
if (import.meta.env.DEV) (window as unknown as { __audio: HTMLAudioElement }).__audio = audio
audio.preload = 'auto'
audio.setAttribute('playsinline', '')

let loadToken = 0
let blobUrl: string | null = null
let watchdog: number | undefined
let resumeAt = 0

function clearWatchdog() {
  clearTimeout(watchdog)
  watchdog = undefined
}

function tryPlay() {
  audio.play().catch((err: DOMException) => {
    // NotAllowedError : iOS exige un toucher → on laisse le bouton lecture visible.
    if (err.name === 'NotAllowedError') set({ playing: false, loading: false })
  })
}

async function loadFull(track: Track, token: number, startAt: number) {
  clearWatchdog()
  set({ source: 'full', dlProgress: 0, loading: true, error: null })
  try {
    const blob = await downloadFull(track, (r) => token === loadToken && set({ dlProgress: r }), () => token !== loadToken)
    if (!blob || token !== loadToken) return
    if (blobUrl) URL.revokeObjectURL(blobUrl)
    blobUrl = URL.createObjectURL(blob)
    resumeAt = startAt
    audio.src = blobUrl
    set({ dlProgress: null })
    tryPlay()
  } catch (err) {
    if (token === loadToken) set({ error: frenchError(err), loading: false, playing: false, dlProgress: null })
  }
}

function load(track: Track) {
  const token = ++loadToken
  clearWatchdog()
  registerTrack(track)
  protect([track.key])
  resumeAt = 0
  set({ current: track, loading: true, error: null, position: 0, duration: track.duration, dlProgress: null })

  const mode = useApp.getState().playbackMode
  if (mode !== 'full' && streamAvailable()) {
    set({ source: 'stream' })
    audio.src = streamUrl(track)
    tryPlay() // appelé tout de suite, dans le geste de l'utilisateur (exigence iOS)
    if (mode === 'auto') {
      // Si rien ne démarre au bout de 20 s, on bascule sur le téléchargement complet.
      watchdog = window.setTimeout(() => {
        if (token === loadToken && audio.readyState < 2) void loadFull(track, token, audio.currentTime || 0)
      }, 20000)
    }
  } else {
    // Même sans streaming, on « débloque » l'élément audio pendant le toucher.
    void loadFull(track, token, 0)
  }
}

export function playList(tracks: Track[], index: number) {
  set({ queue: tracks, index })
  load(tracks[index])
}

export function toggle() {
  const s = get()
  if (!s.current) return
  if (s.error) return load(s.current)
  if (audio.paused) tryPlay()
  else audio.pause()
}

export function next() {
  const { queue, index } = get()
  if (index + 1 < queue.length) {
    set({ index: index + 1 })
    load(queue[index + 1])
  } else {
    audio.pause()
    set({ playing: false })
  }
}

export function prev() {
  const { queue, index } = get()
  if (audio.currentTime > 3 || index <= 0) {
    audio.currentTime = 0
    return
  }
  set({ index: index - 1 })
  load(queue[index - 1])
}

export function seek(seconds: number) {
  audio.currentTime = seconds
  set({ position: seconds })
}

audio.addEventListener('loadedmetadata', () => {
  if (resumeAt > 0) {
    audio.currentTime = resumeAt
    resumeAt = 0
  }
})
audio.addEventListener('playing', () => {
  clearWatchdog()
  set({ playing: true, loading: false, error: null })
})
audio.addEventListener('pause', () => set({ playing: false }))
audio.addEventListener('waiting', () => set({ loading: true }))
audio.addEventListener('canplay', () => set({ loading: false }))
audio.addEventListener('timeupdate', () => set({ position: audio.currentTime }))
audio.addEventListener('durationchange', () => {
  if (isFinite(audio.duration) && audio.duration > 0) set({ duration: audio.duration })
})
audio.addEventListener('ended', () => next())
audio.addEventListener('error', () => {
  const s = get()
  if (!s.current || !audio.src) return
  const token = loadToken
  if (s.source === 'stream' && useApp.getState().playbackMode === 'auto') {
    // Repli : le streaming a échoué, on télécharge le fichier entier.
    void loadFull(s.current, token, audio.currentTime || 0)
    return
  }
  clearWatchdog()
  const unsupported = audio.error?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || audio.error?.code === MediaError.MEDIA_ERR_DECODE
  set({
    loading: false,
    playing: false,
    error: unsupported ? 'Format audio non pris en charge par Safari.' : 'Lecture impossible. Touchez pour réessayer.',
  })
})
