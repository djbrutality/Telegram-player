// Pochettes : téléchargées à la demande (2 à la fois), puis gardées sur le téléphone.
import { getCover, putCover } from './db'
import type { Track } from './types'
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
