// Le lecteur : un seul élément <audio> pour toute l'appli, sa file d'attente,
// le préchargement du morceau suivant et la sauvegarde de la position.
import { create } from 'zustand'
import { getTracksByKeys, kvGet, kvSet } from '../lib/db'
import type { Track } from '../lib/types'
import { useApp } from '../store'
import { frenchError } from '../tg/client'
import { downloadFull, fullBlob, protect, registerTrack, streamAvailable, streamUrl } from './stream'

export type RepeatMode = 'off' | 'all' | 'one'

interface PlayerState {
  queue: Track[]
  index: number
  current: Track | null
  /** d'où vient la file (nom du groupe, « Derniers ajouts »…) */
  context: string | null
  playing: boolean
  loading: boolean
  position: number
  duration: number
  error: string | null
  /** comment le morceau en cours est lu */
  source: 'stream' | 'full' | null
  /** avancement (0-1) du téléchargement complet, sinon null */
  dlProgress: number | null
  shuffle: boolean
  repeat: RepeatMode
}

export const usePlayer = create<PlayerState>(() => ({
  queue: [],
  index: -1,
  current: null,
  context: null,
  playing: false,
  loading: false,
  position: 0,
  duration: 0,
  error: null,
  source: null,
  dlProgress: null,
  shuffle: false,
  repeat: 'off',
}))

const set = usePlayer.setState
const get = usePlayer.getState

export const audio = new Audio()
if (import.meta.env.DEV) (window as unknown as { __audio: HTMLAudioElement }).__audio = audio
audio.preload = 'auto'
audio.setAttribute('playsinline', '')

/** Au-delà de cette taille, on ne précharge pas le morceau en mémoire. */
const MAX_PRELOAD = 80 * 1024 * 1024

let loadToken = 0
let blobUrl: string | null = null
let watchdog: number | undefined
let resumeAt = 0
/** ordre d'origine de la file quand la lecture aléatoire est active */
let baseQueue: Track[] | null = null
/** position à reprendre pour un morceau restauré mais pas encore chargé */
let pendingResume: number | null = null

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

function useBlob(blob: Blob, startAt: number) {
  if (blobUrl) URL.revokeObjectURL(blobUrl)
  blobUrl = URL.createObjectURL(blob)
  resumeAt = startAt
  audio.src = blobUrl
  set({ source: 'full', dlProgress: null })
  tryPlay()
}

async function loadFull(track: Track, token: number, startAt: number) {
  clearWatchdog()
  set({ source: 'full', dlProgress: 0, loading: true, error: null })
  try {
    const blob = await downloadFull(track, (r) => token === loadToken && set({ dlProgress: r }), () => token !== loadToken)
    if (!blob || token !== loadToken) return
    useBlob(blob, startAt)
  } catch (err) {
    if (token === loadToken) set({ error: frenchError(err), loading: false, playing: false, dlProgress: null })
  }
}

function load(track: Track, startAt = 0) {
  const token = ++loadToken
  clearWatchdog()
  pendingResume = null
  registerTrack(track)
  resumeAt = 0
  set({ current: track, loading: true, error: null, position: startAt, duration: track.duration, dlProgress: null })
  scheduleWarm()

  // Morceau déjà en mémoire (préchargé) : démarrage immédiat, sans réseau.
  const ready = fullBlob(track.key)
  if (ready) return useBlob(ready, startAt)

  const mode = useApp.getState().playbackMode
  if (mode !== 'full' && streamAvailable()) {
    set({ source: 'stream' })
    resumeAt = startAt
    audio.src = streamUrl(track)
    tryPlay() // appelé tout de suite, dans le geste de l'utilisateur (exigence iOS)
    if (mode === 'auto') {
      // Si rien ne démarre au bout de 20 s, on bascule sur le téléchargement complet.
      watchdog = window.setTimeout(() => {
        if (token === loadToken && audio.readyState < 2) void loadFull(track, token, audio.currentTime || startAt)
      }, 20000)
    }
  } else {
    void loadFull(track, token, startAt)
  }
}

// ---------- Préchargement ----------

function peekNext(): Track | null {
  const { queue, index, repeat } = get()
  if (repeat === 'one') return null
  if (index + 1 < queue.length) return queue[index + 1]
  return repeat === 'all' && queue.length > 1 ? queue[0] : null
}

let warmToken = 0
/**
 * Quelques secondes après le début d'un morceau, on finit de le télécharger en mémoire,
 * puis on télécharge le suivant : l'enchaînement se fait alors sans attente,
 * même écran verrouillé.
 */
function scheduleWarm() {
  const token = ++warmToken
  const { current } = get()
  const upcoming = peekNext()
  protect([current?.key, upcoming?.key].filter((k): k is string => !!k))
  window.setTimeout(async () => {
    const cancelled = () => token !== warmToken
    if (cancelled() || !current || audio.paused) return
    try {
      if (current.size <= MAX_PRELOAD) await downloadFull(current, undefined, cancelled)
      if (cancelled()) return
      if (upcoming && upcoming.size <= MAX_PRELOAD) await downloadFull(upcoming, undefined, cancelled)
    } catch {
      /* le préchargement est facultatif : en cas d'échec, la lecture normale prend le relais */
    }
  }, 4000)
}

// ---------- File d'attente ----------

function shuffled<T>(list: T[]): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function playList(tracks: Track[], index: number, context: string | null = null) {
  if (get().shuffle) {
    baseQueue = tracks
    const rest = tracks.filter((_, i) => i !== index)
    set({ queue: [tracks[index], ...shuffled(rest)], index: 0, context })
  } else {
    baseQueue = null
    set({ queue: tracks, index, context })
  }
  load(get().queue[get().index])
}

export function toggle() {
  const s = get()
  if (!s.current) return
  if (s.error) return load(s.current, s.position)
  if (pendingResume !== null || !audio.src) return load(s.current, pendingResume ?? 0)
  if (audio.paused) {
    tryPlay()
    scheduleWarm()
  } else audio.pause()
}

/** Passe au morceau suivant. `auto` = fin naturelle du morceau (et non appui sur le bouton). */
export function next(auto = false) {
  const { queue, index, repeat, current } = get()
  if (auto && repeat === 'one' && current) {
    audio.currentTime = 0
    tryPlay()
    return
  }
  if (index + 1 < queue.length) {
    set({ index: index + 1 })
    load(queue[index + 1])
  } else if (repeat === 'all' && queue.length > 0) {
    set({ index: 0 })
    load(queue[0])
  } else {
    audio.pause()
    set({ playing: false })
  }
}

export function prev() {
  const { queue, index, current } = get()
  if (pendingResume !== null && current) return load(current, 0)
  if (audio.currentTime > 3 || index <= 0) {
    audio.currentTime = 0
    set({ position: 0 })
    return
  }
  set({ index: index - 1 })
  load(queue[index - 1])
}

export function jumpTo(index: number) {
  const { queue } = get()
  if (!queue[index]) return
  set({ index })
  load(queue[index])
}

export function seek(seconds: number) {
  if (pendingResume !== null) {
    pendingResume = seconds
  } else {
    audio.currentTime = seconds
  }
  set({ position: seconds })
  saveResume()
}

export function toggleShuffle() {
  const { shuffle, queue, index, current } = get()
  if (!shuffle) {
    baseQueue = queue
    const rest = queue.filter((_, i) => i !== index)
    set({ shuffle: true, queue: current ? [current, ...shuffled(rest)] : shuffled(queue), index: current ? 0 : -1 })
  } else {
    const base = baseQueue ?? queue
    baseQueue = null
    const at = current ? base.findIndex((t) => t.key === current.key) : -1
    set({ shuffle: false, queue: base, index: at >= 0 ? at : index })
  }
  scheduleWarm()
}

export function cycleRepeat() {
  const order: RepeatMode[] = ['off', 'all', 'one']
  set({ repeat: order[(order.indexOf(get().repeat) + 1) % order.length] })
  scheduleWarm()
}

function insertInBase(track: Track, afterKey: string | undefined) {
  if (!baseQueue) return
  const base = baseQueue.filter((t) => t.key !== track.key)
  const at = afterKey ? base.findIndex((t) => t.key === afterKey) : -1
  if (at >= 0) base.splice(at + 1, 0, track)
  else base.push(track)
  baseQueue = base
}

/** Place un morceau juste après celui en cours. */
export function playNext(track: Track) {
  const { queue, index, current } = get()
  if (!current) return playList([track], 0)
  if (current.key === track.key) return
  const q: Track[] = []
  let newIndex = index
  queue.forEach((t, i) => {
    if (t.key === track.key) {
      if (i < index) newIndex--
      return
    }
    q.push(t)
  })
  q.splice(newIndex + 1, 0, track)
  insertInBase(track, current.key)
  set({ queue: q, index: newIndex })
  scheduleWarm()
}

/** Ajoute un morceau à la fin de la file. */
export function addToQueue(track: Track) {
  const { queue, current } = get()
  if (!current) return playList([track], 0)
  if (queue.some((t) => t.key === track.key)) return
  insertInBase(track, undefined)
  set({ queue: [...queue, track] })
  scheduleWarm()
}

export function removeFromQueue(i: number) {
  const { queue, index } = get()
  if (i === index || !queue[i]) return
  const removed = queue[i]
  if (baseQueue) baseQueue = baseQueue.filter((t) => t.key !== removed.key)
  set({ queue: queue.filter((_, k) => k !== i), index: i < index ? index - 1 : index })
  scheduleWarm()
}

// ---------- Reprise de lecture ----------
// iOS ferme souvent les web apps en arrière-plan : on note en continu où on en est.

const K_RESUME = 'onde.resume'

function saveResume() {
  const s = get()
  if (!s.current) return
  try {
    localStorage.setItem(
      K_RESUME,
      JSON.stringify({ key: s.current.key, index: s.index, position: Math.floor(s.position), shuffle: s.shuffle, repeat: s.repeat }),
    )
  } catch {
    /* stockage plein : tant pis */
  }
}

let queueTimer: number | undefined
function saveQueueSoon() {
  clearTimeout(queueTimer)
  queueTimer = window.setTimeout(() => {
    const s = get()
    void kvSet('queue', {
      keys: s.queue.map((t) => t.key),
      baseKeys: baseQueue ? baseQueue.map((t) => t.key) : null,
      context: s.context,
    })
  }, 800)
}

let lastSaved = 0
usePlayer.subscribe((s, old) => {
  if (s.queue !== old.queue || s.context !== old.context) saveQueueSoon()
  const now = Date.now()
  if (s.index !== old.index || s.current !== old.current || s.shuffle !== old.shuffle || s.repeat !== old.repeat || s.playing !== old.playing) {
    lastSaved = now
    saveResume()
  } else if (s.position !== old.position && now - lastSaved > 3000) {
    lastSaved = now
    saveResume()
  }
})
document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && saveResume())
window.addEventListener('pagehide', saveResume)

/** À l'ouverture : remet le dernier morceau, sa position et la file (en pause). */
export async function restorePlayer() {
  try {
    const r = JSON.parse(localStorage.getItem(K_RESUME) || 'null') as
      | { key: string; index: number; position: number; shuffle: boolean; repeat: RepeatMode }
      | null
    const q = await kvGet<{ keys: string[]; baseKeys: string[] | null; context: string | null }>('queue')
    if (!r || !q?.keys?.length) return
    const queue = await getTracksByKeys(q.keys)
    let index = queue[r.index]?.key === r.key ? r.index : queue.findIndex((t) => t.key === r.key)
    if (index < 0) return
    baseQueue = r.shuffle && q.baseKeys ? await getTracksByKeys(q.baseKeys) : null
    const current = queue[index]
    pendingResume = r.position || 0
    set({
      queue,
      index,
      current,
      context: q.context ?? null,
      position: pendingResume,
      duration: current.duration,
      shuffle: !!r.shuffle && !!baseQueue,
      repeat: r.repeat ?? 'off',
    })
  } catch {
    /* sauvegarde illisible : on démarre simplement sans reprise */
  }
}

// ---------- Événements de l'élément audio ----------

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
audio.addEventListener('timeupdate', () => {
  if (resumeAt > 0) return // la position de reprise n'est pas encore appliquée
  set({ position: audio.currentTime })
})
audio.addEventListener('durationchange', () => {
  if (isFinite(audio.duration) && audio.duration > 0) set({ duration: audio.duration })
})
audio.addEventListener('ended', () => next(true))
audio.addEventListener('error', () => {
  const s = get()
  if (!s.current || !audio.src) return
  const token = loadToken
  if (s.source === 'stream' && useApp.getState().playbackMode === 'auto') {
    // Repli : le streaming a échoué, on télécharge le fichier entier.
    void loadFull(s.current, token, audio.currentTime || s.position || 0)
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
