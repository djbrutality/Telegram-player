// Écoute hors ligne : les morceaux choisis sont téléchargés en entier et gardés sur le téléphone.
import { create } from 'zustand'
import { backend } from '../tg/backend'
import { clearOfflineStores, deleteOffline, getOfflineMetas, putOffline, type OfflineMeta } from './db'
import type { Track } from './types'
import { toast } from '../store'

const CHUNK = 512 * 1024

interface OfflineState {
  /** morceaux disponibles hors ligne (identifiant → taille et date) */
  saved: Record<string, OfflineMeta>
  /** morceaux en attente de téléchargement */
  queue: Track[]
  /** téléchargement en cours */
  current: { key: string; progress: number } | null
}
export const useOffline = create<OfflineState>(() => ({ saved: {}, queue: [], current: null }))

export async function loadOfflineState() {
  const saved: Record<string, OfflineMeta> = {}
  for (const m of await getOfflineMetas()) saved[m.key] = m
  useOffline.setState({ saved })
  // Demande à iOS de ne pas effacer ces données quand l'espace manque (accordé ou non selon le système).
  navigator.storage?.persist?.().catch(() => {})
}

export function isOffline(key: string) {
  return key in useOffline.getState().saved
}

export function offlineTotals() {
  const list = Object.values(useOffline.getState().saved)
  return { count: list.length, bytes: list.reduce((n, m) => n + m.size, 0) }
}

let running = false
let cancelToken = 0

/** Ajoute des morceaux à la file de téléchargement hors ligne. Renvoie le nombre réellement ajouté. */
export function keepOffline(tracks: Track[]): number {
  const s = useOffline.getState()
  const waiting = new Set(s.queue.map((t) => t.key))
  const fresh = tracks.filter((t) => !(t.key in s.saved) && !waiting.has(t.key) && s.current?.key !== t.key)
  if (!fresh.length) return 0
  useOffline.setState({ queue: [...s.queue, ...fresh] })
  if (!running) void work()
  return fresh.length
}

async function work() {
  running = true
  const token = cancelToken
  try {
    for (;;) {
      const [track, ...rest] = useOffline.getState().queue
      if (!track || token !== cancelToken) break
      useOffline.setState({ queue: rest, current: { key: track.key, progress: 0 } })
      try {
        const api = await backend()
        const parts: Uint8Array[] = []
        for (let offset = 0; offset < track.size; offset += CHUNK) {
          if (token !== cancelToken) return
          parts.push(await api.getFile(track, offset, CHUNK))
          useOffline.setState({ current: { key: track.key, progress: Math.min(1, (offset + CHUNK) / track.size) } })
        }
        const meta = await putOffline(track.key, new Blob(parts as BlobPart[], { type: track.mime || 'audio/mpeg' }))
        useOffline.setState((s) => ({ saved: { ...s.saved, [track.key]: meta } }))
      } catch (err) {
        const quota = (err as DOMException)?.name === 'QuotaExceededError'
        toast(quota ? 'Espace insuffisant sur le téléphone' : 'Téléchargement interrompu')
        // On arrête la file : inutile d'enchaîner les échecs (hors ligne, espace plein…).
        useOffline.setState({ queue: [] })
        break
      }
    }
  } finally {
    running = false
    useOffline.setState({ current: null })
  }
}

export function cancelDownloads() {
  cancelToken++
  useOffline.setState({ queue: [], current: null })
}

export async function removeOffline(key: string) {
  await deleteOffline(key)
  useOffline.setState((s) => {
    const saved = { ...s.saved }
    delete saved[key]
    return { saved }
  })
}

export async function clearOffline() {
  cancelDownloads()
  await clearOfflineStores()
  useOffline.setState({ saved: {} })
}
