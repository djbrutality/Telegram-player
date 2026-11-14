// Accès en lecture à la bibliothèque locale, rechargée quand l'index change.
import { useEffect, useState } from 'react'
import { useApp } from '../store'
import { getAllTracks, getTracksOfChat } from './db'
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
