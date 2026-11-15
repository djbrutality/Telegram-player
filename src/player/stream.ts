// Streaming : le lecteur audio demande des « tranches » du fichier (requêtes Range),
// le service worker les transmet ici, et on télécharge les blocs voulus depuis Telegram.
import { getOfflineBlob, getTrack } from '../lib/db'
import { isOffline } from '../lib/offline'
import type { Track } from '../lib/types'
import { backend } from '../tg/backend'

export const CHUNK = 512 * 1024
const MAX_CACHE_BYTES = 48 * 1024 * 1024
const READ_AHEAD = 2

const registry = new Map<string, Track>()
const chunks = new Map<string, Map<number, Uint8Array>>()
const inflight = new Map<string, Promise<Uint8Array>>()
const fullBlobs = new Map<string, Blob>()
let protectedKeys = new Set<string>()

export function registerTrack(track: Track) {
  registry.set(track.key, track)
}

/** Morceaux à ne pas retirer de la mémoire (en cours et suivant). */
export function protect(keys: string[]) {
  protectedKeys = new Set(keys)
  // On garde les morceaux protégés, plus le dernier téléchargé (utile pour « précédent »).
  const loose = [...fullBlobs.keys()].filter((k) => !protectedKeys.has(k))
  for (const k of loose.slice(0, -1)) fullBlobs.delete(k)
  evict()
}

export function fullBlob(key: string) {
  return fullBlobs.get(key)
}

export function normalizeMime(track: Track): string {
  const m = (track.mime || '').toLowerCase()
  const fixes: Record<string, string> = {
    'audio/mp3': 'audio/mpeg',
    'audio/x-mp3': 'audio/mpeg',
    'audio/mpeg3': 'audio/mpeg',
    'audio/x-flac': 'audio/flac',
    'audio/x-m4a': 'audio/mp4',
    'audio/m4a': 'audio/mp4',
    'audio/x-wav': 'audio/wav',
    'audio/wave': 'audio/wav',
    'audio/x-aac': 'audio/aac',
    'audio/x-aiff': 'audio/aiff',
  }
  if (fixes[m]) return fixes[m]
  if (m.startsWith('audio/')) return m
  const ext = track.fileName?.split('.').pop()?.toLowerCase() ?? ''
  const byExt: Record<string, string> = {
    mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
    wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', aif: 'audio/aiff', aiff: 'audio/aiff',
  }
  return byExt[ext] ?? 'audio/mpeg'
}

function cacheBytes() {
  let n = 0
  for (const m of chunks.values()) for (const c of m.values()) n += c.byteLength
  return n
}

function evict() {
  if (cacheBytes() <= MAX_CACHE_BYTES) return
  for (const key of [...chunks.keys()]) {
    if (protectedKeys.has(key)) continue
    chunks.delete(key)
    if (cacheBytes() <= MAX_CACHE_BYTES) return
  }
}

export function chunkCount(track: Track) {
  return Math.max(1, Math.ceil(track.size / CHUNK))
}

/** Bloc n° `i` du fichier (512 Ko), depuis la mémoire ou depuis Telegram. */
export function getChunk(track: Track, i: number): Promise<Uint8Array> {
  const have = chunks.get(track.key)?.get(i)
  if (have) return Promise.resolve(have)
  const id = `${track.key}#${i}`
  let p = inflight.get(id)
  if (!p) {
    p = (async () => {
      const bytes = await (await backend()).getFile(track, i * CHUNK, CHUNK)
      let m = chunks.get(track.key)
      if (!m) chunks.set(track.key, (m = new Map()))
      m.set(i, bytes)
      evict()
      return bytes
    })().finally(() => inflight.delete(id))
    inflight.set(id, p)
  }
  return p
}

export interface RangeReply {
  buffer: ArrayBuffer
  start: number
  total: number
  mime: string
}

/** Répond à une requête Range : renvoie au plus un bloc à partir de `start`. */
export async function readRange(key: string, start: number, end: number | null): Promise<RangeReply> {
  const track = registry.get(key) ?? (await getTrack(key))
  if (!track) throw Object.assign(new Error('Morceau inconnu'), { status: 404 })
  registry.set(key, track)
  const total = track.size
  if (start >= total) throw Object.assign(new Error('Hors limites'), { status: 416 })
  const mime = normalizeMime(track)
  const last = Math.min(end ?? total - 1, total - 1)

  const blob = fullBlobs.get(key)
  if (blob) {
    const stop = Math.min(last + 1, start + 2 * CHUNK)
    return { buffer: await blob.slice(start, stop).arrayBuffer(), start, total, mime }
  }

  const i = Math.floor(start / CHUNK)
  const chunk = await getChunk(track, i)
  const from = start - i * CHUNK
  const to = Math.min(last - i * CHUNK + 1, chunk.byteLength)
  if (to <= from) throw Object.assign(new Error('Bloc vide'), { status: 502 })
  const buffer = chunk.slice(from, to).buffer as ArrayBuffer

  // Lecture anticipée : on prépare les blocs suivants pendant que celui-ci joue.
  const n = chunkCount(track)
  for (let k = 1; k <= READ_AHEAD; k++) if (i + k < n) getChunk(track, i + k).catch(() => {})

  return { buffer, start, total, mime }
}

/** Télécharge le fichier entier en mémoire (repli si le streaming échoue, et préchargement). */
export async function downloadFull(
  track: Track,
  onProgress?: (ratio: number) => void,
  cancelled?: () => boolean,
): Promise<Blob | null> {
  const existing = fullBlobs.get(track.key)
  if (existing) return existing
  registerTrack(track)
  // Morceau gardé hors ligne : on le prend sur le téléphone, sans réseau.
  if (isOffline(track.key)) {
    const stored = await getOfflineBlob(track.key)
    if (stored) {
      fullBlobs.set(track.key, stored)
      return stored
    }
  }
  const n = chunkCount(track)
  const parts: Uint8Array[] = []
  for (let i = 0; i < n; i++) {
    if (cancelled?.()) return null
    parts.push(await getChunk(track, i))
    onProgress?.((i + 1) / n)
  }
  const blob = new Blob(parts as BlobPart[], { type: normalizeMime(track) })
  fullBlobs.set(track.key, blob)
  chunks.delete(track.key)
  return blob
}

export function hasFull(key: string) {
  return fullBlobs.has(key)
}

// --- Liaison avec le service worker ---

export function streamUrl(track: Track): string {
  return new URL(`stream/${encodeURIComponent(track.key)}`, document.baseURI).href
}

export function streamAvailable(): boolean {
  return !!navigator.serviceWorker?.controller
}

export async function initStreaming() {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.addEventListener('message', (event) => {
    const data = event.data
    const port = event.ports[0]
    if (data?.type !== 'onde-range' || !port) return
    readRange(data.key, data.start, data.end).then(
      (r) => port.postMessage({ ok: true, ...r }, [r.buffer]),
      (err) => port.postMessage({ ok: false, error: String(err?.message ?? err), status: err?.status ?? 500 }),
    )
  })
  try {
    await navigator.serviceWorker.register(new URL('sw.js', document.baseURI).href)
    // Au tout premier lancement, on attend que le service worker prenne la main.
    if (!navigator.serviceWorker.controller) {
      await Promise.race([
        new Promise<void>((r) => navigator.serviceWorker.addEventListener('controllerchange', () => r(), { once: true })),
        new Promise<void>((r) => setTimeout(r, 3000)),
      ])
    }
  } catch (err) {
    console.warn('Service worker indisponible', err)
  }
  // Une fois l'appli chargée, on indique au service worker quels fichiers garder
  // pour pouvoir la rouvrir sans réseau.
  setTimeout(cacheAppShell, 6000)
}

function cacheAppShell() {
  const sw = navigator.serviceWorker?.controller
  if (!sw) return
  const scope = new URL('.', document.baseURI).href
  const urls = new Set<string>([scope])
  for (const el of document.querySelectorAll<HTMLLinkElement | HTMLScriptElement>('script[src], link[href]')) {
    urls.add(new URL((el as HTMLScriptElement).src || (el as HTMLLinkElement).href, document.baseURI).href)
  }
  for (const e of performance.getEntriesByType('resource')) urls.add(e.name)
  const list = [...urls].filter((u) => u.startsWith(scope) && !u.includes('/stream/') && !u.endsWith('/sw.js'))
  sw.postMessage({ type: 'onde-shell', urls: list })
}
