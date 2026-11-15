// Données personnelles : favoris, playlists et corrections de titres/artistes.
// Elles vivent sur le téléphone et sont copiées dans la sauvegarde Telegram.
import { create } from 'zustand'
import { kvGet, kvSet } from './db'

export interface Playlist {
  id: string
  name: string
  keys: string[]
  createdAt: number
}
export interface Override {
  title?: string
  performer?: string
}
export interface UserData {
  /** du plus récent au plus ancien */
  favorites: { key: string; at: number }[]
  playlists: Playlist[]
  overrides: Record<string, Override>
}

interface UserState extends UserData {
  /** augmente à chaque correction de métadonnées (pour rafraîchir l'affichage) */
  metaVersion: number
}

export const useUser = create<UserState>(() => ({ favorites: [], playlists: [], overrides: {}, metaVersion: 0 }))

let onChange: (() => void) | null = null
/** Fonction appelée après chaque modification (sert à déclencher la sauvegarde). */
export function onUserDataChange(fn: () => void) {
  onChange = fn
}

export function snapshot(): UserData {
  const { favorites, playlists, overrides } = useUser.getState()
  return { favorites, playlists, overrides }
}

function commit(patch: Partial<UserState>, silent = false) {
  useUser.setState(patch)
  void kvSet('userdata', snapshot())
  if (!silent) onChange?.()
}

export async function loadUserData() {
  const saved = await kvGet<UserData>('userdata')
  if (saved) useUser.setState({ favorites: saved.favorites ?? [], playlists: saved.playlists ?? [], overrides: saved.overrides ?? {} })
}

/** Remplace tout (restauration d'une sauvegarde). */
export function replaceUserData(data: Partial<UserData>) {
  commit(
    {
      favorites: Array.isArray(data.favorites) ? data.favorites : [],
      playlists: Array.isArray(data.playlists) ? data.playlists : [],
      overrides: data.overrides && typeof data.overrides === 'object' ? data.overrides : {},
      metaVersion: useUser.getState().metaVersion + 1,
    },
    true,
  )
}

export function isUserDataEmpty() {
  const s = useUser.getState()
  return !s.favorites.length && !s.playlists.length && !Object.keys(s.overrides).length
}

// --- Favoris ---
export function isFavorite(key: string) {
  return useUser.getState().favorites.some((f) => f.key === key)
}
export function toggleFavorite(key: string): boolean {
  const { favorites } = useUser.getState()
  const had = favorites.some((f) => f.key === key)
  commit({ favorites: had ? favorites.filter((f) => f.key !== key) : [{ key, at: Date.now() }, ...favorites] })
  return !had
}

// --- Playlists ---
export function createPlaylist(name: string, firstKey?: string): Playlist {
  const p: Playlist = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, keys: firstKey ? [firstKey] : [], createdAt: Date.now() }
  commit({ playlists: [p, ...useUser.getState().playlists] })
  return p
}
function editPlaylist(id: string, fn: (p: Playlist) => Playlist) {
  commit({ playlists: useUser.getState().playlists.map((p) => (p.id === id ? fn(p) : p)) })
}
export function renamePlaylist(id: string, name: string) {
  editPlaylist(id, (p) => ({ ...p, name }))
}
export function deletePlaylist(id: string) {
  commit({ playlists: useUser.getState().playlists.filter((p) => p.id !== id) })
}
/** Renvoie false si le morceau y était déjà. */
export function addToPlaylist(id: string, key: string): boolean {
  const p = useUser.getState().playlists.find((x) => x.id === id)
  if (!p || p.keys.includes(key)) return false
  editPlaylist(id, (x) => ({ ...x, keys: [...x.keys, key] }))
  return true
}
export function removeFromPlaylist(id: string, key: string) {
  editPlaylist(id, (p) => ({ ...p, keys: p.keys.filter((k) => k !== key) }))
}

// --- Corrections de métadonnées ---
export function getOverride(key: string): Override | undefined {
  return useUser.getState().overrides[key]
}
export function setOverride(key: string, value: Override) {
  const overrides = { ...useUser.getState().overrides }
  const clean: Override = {}
  if (value.title?.trim()) clean.title = value.title.trim()
  if (value.performer?.trim()) clean.performer = value.performer.trim()
  if (clean.title || clean.performer) overrides[key] = clean
  else delete overrides[key]
  commit({ overrides, metaVersion: useUser.getState().metaVersion + 1 })
}
