// Pochettes : téléchargées à la demande (2 à la fois), puis gardées sur le téléphone.
import { getCover, putCover } from './db'
import type { ChatInfo, Track } from './types'
import { backend } from '../tg/backend'

const urls = new Map<string, string | null>()
const pending = new Map<string, Promise<string | null>>()
const waiting: (() => void)[] = []
let active = 0

async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((r) => waiting.push(r))
  active++
  try {
    return await fn()
  } finally {
    active--
    waiting.shift()?.()
  }
}

export function cachedCoverUrl(track: Track): string | null | undefined {
  if (!track.thumbType) return null
  return urls.get(track.key)
}

export function coverUrl(track: Track): Promise<string | null> {
  if (!track.thumbType) return Promise.resolve(null)
  if (urls.has(track.key)) return Promise.resolve(urls.get(track.key)!)
  let p = pending.get(track.key)
  if (!p) {
    p = (async () => {
      let blob = await getCover(track.key)
      if (!blob) {
        const fetched = await slot(async () => (await backend()).getThumb(track))
        if (fetched) {
          blob = fetched
          await putCover(track.key, fetched)
        }
      }
      const url = blob ? URL.createObjectURL(blob) : null
      urls.set(track.key, url)
      return url
    })()
      .catch(() => null)
      .finally(() => pending.delete(track.key))
    pending.set(track.key, p)
  }
  return p
}

export async function coverBlob(track: Track): Promise<Blob | undefined> {
  await coverUrl(track)
  return getCover(track.key)
}

// ---------- Photos de profil des groupes ----------

const chatKey = (c: ChatInfo) => `chat_${c.id}_${c.photoId ?? 'x'}`

export function cachedChatPhotoUrl(chat: ChatInfo): string | null | undefined {
  return urls.get(chatKey(chat))
}

export function chatPhotoUrl(chat: ChatInfo): Promise<string | null> {
  const key = chatKey(chat)
  if (urls.has(key)) return Promise.resolve(urls.get(key)!)
  let p = pending.get(key)
  if (!p) {
    p = (async () => {
      let blob = await getCover(key)
      if (!blob) {
        const fetched = await slot(async () => (await backend()).getChatPhoto(chat))
        if (fetched) {
          blob = fetched
          await putCover(key, fetched)
        }
      }
      const url = blob ? URL.createObjectURL(blob) : null
      urls.set(key, url)
      return url
    })()
      .catch(() => null)
      .finally(() => pending.delete(key))
    pending.set(key, p)
  }
  return p
}
