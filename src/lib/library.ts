// Accès en lecture à la bibliothèque locale, toujours par petits morceaux :
// on ne charge jamais tous les morceaux d'un groupe (ou de la bibliothèque) d'un coup.
import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { getChatKeys, getRecentTracks, getTracksByKeys } from './db'
import type { Track } from './types'

/** Identifiants des morceaux d'un groupe, du plus récent au plus ancien. */
export function useChatKeys(chatId: string): string[] | null {
  // On ne relit la liste que lorsque le nombre de morceaux du groupe change.
  const count = useApp((s) => s.progress[chatId]?.count ?? 0)
  const [keys, setKeys] = useState<string[] | null>(null)
  useEffect(() => {
    let alive = true
    getChatKeys(chatId).then((k) => alive && setKeys(k))
    return () => {
      alive = false
    }
  }, [chatId, count])
  return keys
}

export function useRecentTracks(limit: number): Track[] | null {
  const version = useApp((s) => s.libVersion)
  const [tracks, setTracks] = useState<Track[] | null>(null)
  useEffect(() => {
    let alive = true
    getRecentTracks(limit).then((t) => alive && setTracks(t))
    return () => {
      alive = false
    }
  }, [limit, version])
  return tracks
}

/** Morceaux correspondant à une liste d'identifiants (favoris, playlist, résultats), dans le même ordre. */
export function useTracksByKeys(keys: string[] | null): Track[] | null {
  const version = useApp((s) => s.libVersion)
  const [tracks, setTracks] = useState<Track[] | null>(null)
  const signature = keys ? keys.join('|') : null
  useEffect(() => {
    let alive = true
    if (!keys) setTracks(null)
    else getTracksByKeys(keys).then((t) => alive && setTracks(t))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, version])
  return tracks
}

// ---------- Chargement à la demande des lignes d'une longue liste ----------

const cache = new Map<string, Track>()
const CACHE_MAX = 4000
let wanted = new Set<string>()
let waiters: (() => void)[] = []
let scheduled = false

function flush() {
  scheduled = false
  const keys = [...wanted]
  const done = waiters
  wanted = new Set()
  waiters = []
  getTracksByKeys(keys)
    .then((tracks) => {
      for (const t of tracks) cache.set(t.key, t)
      // Mémoire bornée : on oublie les plus anciens.
      for (const k of cache.keys()) {
        if (cache.size <= CACHE_MAX) break
        cache.delete(k)
      }
    })
    .finally(() => done.forEach((fn) => fn()))
}

export function cachedTrack(key: string) {
  return cache.get(key)
}

/** Morceau d'une ligne visible : les demandes des lignes voisines sont regroupées en une seule lecture. */
export function useTrack(key: string): Track | undefined {
  const [, refresh] = useState(0)
  const track = cache.get(key)
  useEffect(() => {
    if (cache.has(key)) return
    let alive = true
    wanted.add(key)
    waiters.push(() => alive && refresh((n) => n + 1))
    if (!scheduled) {
      scheduled = true
      setTimeout(flush, 30)
    }
    return () => {
      alive = false
    }
  }, [key])
  return track
}
