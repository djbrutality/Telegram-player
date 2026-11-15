// Base de données locale (IndexedDB) : tout reste sur le téléphone.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ChatInfo, IndexState, Track } from './types'

export const DB_NAME = 'onde'

interface Schema extends DBSchema {
  tracks: { key: string; value: Track; indexes: { byChat: string; byDate: number } }
  chats: { key: string; value: ChatInfo }
  indexState: { key: string; value: IndexState }
  covers: { key: string; value: Blob }
  kv: { key: string; value: unknown }
  /** fichiers audio gardés pour l'écoute hors ligne */
  offline: { key: string; value: Blob }
  offlineMeta: { key: string; value: OfflineMeta }
}

export interface OfflineMeta {
  key: string
  size: number
  at: number
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null

export function db() {
  dbPromise ??= openDB<Schema>(DB_NAME, 3, {
    upgrade(d, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        d.createObjectStore('tracks', { keyPath: 'key' }).createIndex('byChat', 'chatId')
        d.createObjectStore('chats', { keyPath: 'id' })
        d.createObjectStore('indexState', { keyPath: 'chatId' })
        d.createObjectStore('covers')
        d.createObjectStore('kv')
      }
      // v2 : classement par date, pour afficher les derniers ajouts sans tout relire.
      if (oldVersion < 2) tx.objectStore('tracks').createIndex('byDate', 'date')
      // v3 : écoute hors ligne.
      if (oldVersion < 3) {
        d.createObjectStore('offline')
        d.createObjectStore('offlineMeta', { keyPath: 'key' })
      }
    },
  })
  return dbPromise
}

// --- Groupes choisis ---
export async function getSelectedChats(): Promise<ChatInfo[]> {
  const list = await (await db()).getAll('chats')
  return list.sort((a, b) => a.title.localeCompare(b.title, 'fr'))
}

/** Remplace la sélection ; supprime l'index des groupes retirés. */
export async function setSelectedChats(chats: ChatInfo[]) {
  const d = await db()
  const keep = new Set(chats.map((c) => c.id))
  const old = await d.getAllKeys('chats')
  for (const id of old) if (!keep.has(id)) await deleteChatData(id)
  const tx = d.transaction('chats', 'readwrite')
  await tx.store.clear()
  for (const c of chats) await tx.store.put(c)
  await tx.done
}

export async function deleteChatData(chatId: string) {
  const d = await db()
  // Les identifiants des morceaux commencent tous par "<groupe>_" : on efface la plage d'un coup.
  const range = IDBKeyRange.bound(`${chatId}_`, `${chatId}_\uffff`)
  const tx = d.transaction(['tracks', 'indexState', 'covers', 'offline', 'offlineMeta'], 'readwrite')
  await tx.objectStore('tracks').delete(range)
  await tx.objectStore('covers').delete(range)
  await tx.objectStore('offline').delete(range)
  await tx.objectStore('offlineMeta').delete(range)
  await tx.objectStore('indexState').delete(chatId)
  await tx.done
}

// --- Morceaux ---
export async function putTracks(tracks: Track[]) {
  if (!tracks.length) return
  const tx = (await db()).transaction('tracks', 'readwrite')
  for (const t of tracks) await tx.store.put(t)
  await tx.done
}

export async function getTrack(key: string) {
  return (await db()).get('tracks', key)
}

/** Identifiants des morceaux d'un groupe, du plus récent au plus ancien (léger, même pour 200 000 morceaux). */
export async function getChatKeys(chatId: string): Promise<string[]> {
  const keys = await (await db()).getAllKeysFromIndex('tracks', 'byChat', chatId)
  const cut = chatId.length + 1
  return keys.sort((a, b) => Number(b.slice(cut)) - Number(a.slice(cut)))
}

/** Les morceaux les plus récents de toute la bibliothèque. */
export async function getRecentTracks(limit: number): Promise<Track[]> {
  const out: Track[] = []
  let cursor = await (await db()).transaction('tracks').store.index('byDate').openCursor(null, 'prev')
  while (cursor && out.length < limit) {
    out.push(cursor.value)
    cursor = await cursor.continue()
  }
  return out
}

export async function countTracks(): Promise<number> {
  return (await db()).count('tracks')
}

/** Parcourt toute la bibliothèque par paquets, sans jamais tout charger en mémoire d'un coup. */
export async function forEachTrackPage(onPage: (tracks: Track[]) => void, cancelled: () => boolean, pageSize = 2500) {
  const d = await db()
  let last: string | undefined
  for (;;) {
    const page: Track[] = await d.getAll('tracks', last === undefined ? undefined : IDBKeyRange.lowerBound(last, true), pageSize)
    if (!page.length || cancelled()) return
    onPage(page)
    last = page[page.length - 1].key
    if (page.length < pageSize) return
    await new Promise((r) => setTimeout(r)) // laisse l'interface respirer
  }
}

// --- Avancement de l'indexation ---
export async function getIndexState(chatId: string) {
  return (await db()).get('indexState', chatId)
}
export async function getAllIndexStates(): Promise<IndexState[]> {
  return (await db()).getAll('indexState')
}
export async function putIndexState(s: IndexState) {
  await (await db()).put('indexState', s)
}

// --- Pochettes ---
export async function getCover(key: string) {
  return (await db()).get('covers', key)
}
export async function putCover(key: string, blob: Blob) {
  await (await db()).put('covers', blob, key)
}

// --- Écoute hors ligne ---
export async function getOfflineMetas(): Promise<OfflineMeta[]> {
  return (await db()).getAll('offlineMeta')
}
export async function getOfflineBlob(key: string) {
  return (await db()).get('offline', key)
}
export async function putOffline(key: string, blob: Blob): Promise<OfflineMeta> {
  const meta = { key, size: blob.size, at: Date.now() }
  const tx = (await db()).transaction(['offline', 'offlineMeta'], 'readwrite')
  await tx.objectStore('offline').put(blob, key)
  await tx.objectStore('offlineMeta').put(meta)
  await tx.done
  return meta
}
export async function deleteOffline(key: string) {
  const tx = (await db()).transaction(['offline', 'offlineMeta'], 'readwrite')
  await tx.objectStore('offline').delete(key)
  await tx.objectStore('offlineMeta').delete(key)
  await tx.done
}
export async function clearOfflineStores() {
  const tx = (await db()).transaction(['offline', 'offlineMeta'], 'readwrite')
  await tx.objectStore('offline').clear()
  await tx.objectStore('offlineMeta').clear()
  await tx.done
}

// --- Réglages divers ---
export async function kvGet<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('kv', key)) as T | undefined
}
export async function kvSet(key: string, value: unknown) {
  await (await db()).put('kv', value, key)
}

/** Efface absolument tout ce que l'appli a stocké sur l'appareil. */
export async function wipeEverything() {
  try {
    ;(await db()).close()
  } catch {
    /* rien */
  }
  dbPromise = null
  await new Promise<void>((resolve) => {
    const req = indexedDB.deleteDatabase(DB_NAME)
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
  localStorage.clear()
  sessionStorage.clear()
  if ('caches' in window) for (const name of await caches.keys()) await caches.delete(name)
}

/** Relit plusieurs morceaux d'un coup, dans l'ordre demandé (les absents sont ignorés). */
export async function getTracksByKeys(keys: string[]): Promise<Track[]> {
  const tx = (await db()).transaction('tracks')
  const found = await Promise.all(keys.map((k) => tx.store.get(k)))
  return found.filter((t): t is Track => !!t)
}
