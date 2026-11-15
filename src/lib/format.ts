import type { ChatInfo, Track } from './types'
import { getOverride } from './userdata'

/** Titre affiché : correction manuelle, sinon métadonnée, sinon nom du fichier. */
export function trackTitle(t: Track): string {
  const fixed = getOverride(t.key)?.title
  if (fixed) return fixed
  if (t.title?.trim()) return t.title.trim()
  if (t.fileName) return t.fileName.replace(/\.[a-z0-9]{2,5}$/i, '')
  return 'Sans titre'
}

export function trackArtist(t: Track): string {
  return getOverride(t.key)?.performer || t.performer?.trim() || 'Artiste inconnu'
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) seconds = 0
  const s = Math.floor(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

export function formatBytes(n: number): string {
  if (n <= 0) return '0 Mo'
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} Ko`
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`
  return `${(n / 1024 ** 3).toFixed(2).replace('.', ',')} Go`
}

/** Teinte stable (0-359) calculée à partir d'un texte, pour les pochettes par défaut. */
export function hueOf(text: string): number {
  let h = 0
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
  return h % 360
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Texte simplifié pour la recherche : minuscules, sans accents ni ponctuation. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** « Canal · @identifiant » ou « Groupe » : permet de distinguer deux conversations du même nom. */
export function chatKind(c: ChatInfo): string {
  return `${c.broadcast ? 'Canal' : 'Groupe'}${c.username ? ` · @${c.username}` : ''}`
}
