// Index de recherche en mémoire : pour chaque morceau, seulement son identifiant,
// sa date et un texte simplifié (titre + artiste + nom de fichier).
// Il est construit par paquets, ce qui reste rapide même avec des centaines de milliers de morceaux.
import { create } from 'zustand'
import { countTracks, forEachTrackPage } from './db'
import { fold, trackArtist, trackTitle } from './format'
import type { Track } from './types'

interface Entry {
  key: string
  hay: string
  date: number
}

interface IndexState {
  status: 'idle' | 'building' | 'ready'
  /** avancement de la construction, de 0 à 1 */
  progress: number
  count: number
  /** augmente à chaque changement (pour relancer la recherche affichée) */
  version: number
}
export const useSearchIndex = create<IndexState>(() => ({ status: 'idle', progress: 0, count: 0, version: 0 }))

let entries: Entry[] = []
let known = new Set<string>()
let generation = 0

const hayOf = (t: Track) => fold(`${trackTitle(t)} ${trackArtist(t)} ${t.fileName ?? ''}`)

function add(tracks: Track[]) {
  for (const t of tracks) {
    if (known.has(t.key)) continue
    known.add(t.key)
    entries.push({ key: t.key, hay: hayOf(t), date: t.date })
  }
}

/** Construit l'index s'il ne l'est pas déjà. */
export function ensureSearchIndex() {
  if (useSearchIndex.getState().status !== 'idle') return
  const gen = ++generation
  entries = []
  known = new Set()
  useSearchIndex.setState({ status: 'building', progress: 0, count: 0 })
  void (async () => {
    try {
      const total = Math.max(1, await countTracks())
      await forEachTrackPage(
        (page) => {
          add(page)
          useSearchIndex.setState({ progress: Math.min(1, entries.length / total), count: entries.length })
        },
        () => gen !== generation,
      )
      if (gen !== generation) return
      useSearchIndex.setState((s) => ({ status: 'ready', progress: 1, count: entries.length, version: s.version + 1 }))
    } catch {
      if (gen === generation) useSearchIndex.setState({ status: 'idle' })
    }
  })()
}

/** Oublie l'index (il sera reconstruit à la prochaine recherche). */
export function resetSearchIndex() {
  generation++
  entries = []
  known = new Set()
  useSearchIndex.setState((s) => ({ status: 'idle', progress: 0, count: 0, version: s.version + 1 }))
}

let bumpTimer: number | undefined
function bumpSoon() {
  bumpTimer ??= window.setTimeout(() => {
    bumpTimer = undefined
    useSearchIndex.setState((s) => ({ count: entries.length, version: s.version + 1 }))
  }, 1500)
}

/** Nouveaux morceaux indexés : on les ajoute sans tout reconstruire. */
export function addToSearchIndex(tracks: Track[]) {
  if (useSearchIndex.getState().status === 'idle') return
  add(tracks)
  bumpSoon()
}

/** Titre ou artiste corrigé : on met à jour le texte de ce morceau. */
export function updateSearchEntry(track: Track) {
  const e = known.has(track.key) ? entries.find((x) => x.key === track.key) : undefined
  if (e) {
    e.hay = hayOf(track)
    bumpSoon()
  }
}

/** Identifiants des morceaux contenant tous les mots, du plus récent au plus ancien. */
export function searchKeys(query: string, limit: number): { keys: string[]; total: number } | null {
  const words = fold(query).split(' ').filter(Boolean)
  if (!words.length) return null
  const hits = entries.filter((e) => words.every((w) => e.hay.includes(w)))
  hits.sort((a, b) => b.date - a.date)
  return { keys: hits.slice(0, limit).map((e) => e.key), total: hits.length }
}
