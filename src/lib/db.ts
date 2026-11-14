// Base de données locale (IndexedDB) : tout reste sur le téléphone.
import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { ChatInfo, IndexState, Track } from './types'

export const DB_NAME = 'onde'

interface Schema extends DBSchema {
  tracks: { key: string; value: Track; indexes: { byChat: string } }
  chats: { key: string; value: ChatInfo }
  indexState: { key: string; value: IndexState }
  covers: { key: string; value: Blob }
  kv: { key: string; value: unknown }
}

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null

export function db() {
  dbPromise ??= openDB<Schema>(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('tracks', { keyPath: 'key' }).createIndex('byChat', 'chatId')
      d.createObjectStore('chats', { keyPath: 'id' })
      d.createObjectStore('indexState', { keyPath: 'chatId' })
      d.createObjectStore('covers')
      d.createObjectStore('kv')
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
  const tx = d.transaction(['tracks', 'indexState', 'covers'], 'readwrite')
  const keys = await tx.objectStore('tracks').index('byChat').getAllKeys(chatId)
  for (const k of keys) {
    await tx.objectStore('tracks').delete(k)
    await tx.objectStore('covers').delete(k)
  }
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

/** Morceaux d'un groupe, du plus récent au plus ancien. */
export async function getTracksOfChat(chatId: string): Promise<Track[]> {
  const list = await (await db()).getAllFromIndex('tracks', 'byChat', chatId)
  return list.sort((a, b) => b.msgId - a.msgId)
}

export async function getAllTracks(): Promise<Track[]> {
  return (await db()).getAll('tracks')
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
