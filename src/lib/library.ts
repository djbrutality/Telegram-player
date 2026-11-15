// Accès en lecture à la bibliothèque locale, rechargée quand l'index change.
import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { getAllTracks, getTracksByKeys, getTracksOfChat } from './db'
import type { Track } from './types'

export function useChatTracks(chatId: string): Track[] | null {
  const version = useApp((s) => s.libVersion)
  const [tracks, setTracks] = useState<Track[] | null>(null)
  useEffect(() => {
    let alive = true
    getTracksOfChat(chatId).then((t) => alive && setTracks(t))
    return () => {
      alive = false
    }
  }, [chatId, version])
  return tracks
}

export function useRecentTracks(limit: number): Track[] | null {
  const version = useApp((s) => s.libVersion)
  const [tracks, setTracks] = useState<Track[] | null>(null)
  useEffect(() => {
    let alive = true
    getAllTracks().then((all) => {
      if (alive) setTracks(all.sort((a, b) => b.date - a.date).slice(0, limit))
    })
    return () => {
      alive = false
    }
  }, [limit, version])
  return tracks
}

let allCache: { version: number; promise: Promise<Track[]> } | null = null
/** Tous les morceaux de la bibliothèque (gardés en mémoire tant que l'index ne change pas). */
export function useAllTracks(): Track[] | null {
  const version = useApp((s) => s.libVersion)
  const [tracks, setTracks] = useState<Track[] | null>(null)
  useEffect(() => {
    let alive = true
    if (allCache?.version !== version) allCache = { version, promise: getAllTracks() }
    allCache.promise.then((t) => alive && setTracks(t))
    return () => {
      alive = false
    }
  }, [version])
  return tracks
}

/** Morceaux correspondant à une liste d'identifiants (favoris, playlist), dans le même ordre. */
export function useTracksByKeys(keys: string[]): Track[] | null {
  const version = useApp((s) => s.libVersion)
  const [tracks, setTracks] = useState<Track[] | null>(null)
  const signature = keys.join('|')
  useEffect(() => {
    let alive = true
    getTracksByKeys(keys).then((t) => alive && setTracks(t))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, version])
  return tracks
}
