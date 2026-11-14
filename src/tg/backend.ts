// Interface entre l'appli et Telegram. Deux implémentations :
// la vraie (telegram.ts) et une fausse pour le développement (demo.ts).
import type { ChatInfo, Track } from '../lib/types'
import { isDemo } from './client'

export interface AudioPage {
  tracks: Track[]
  /** nombre de messages renvoyés par Telegram (0 = plus rien à lire) */
  rawCount: number
  /** plus petit / plus grand identifiant de message de la page */
  minId: number
  maxId: number
  /** nombre total de fichiers audio annoncé par Telegram */
  total: number
}

export interface Backend {
  listChats(): Promise<ChatInfo[]>
  searchAudio(chat: ChatInfo, o: { offsetId: number; minId: number; limit: number }): Promise<AudioPage>
  /** Télécharge `limit` octets à partir de `offset` (multiples de 4096). */
  getFile(track: Track, offset: number, limit: number): Promise<Uint8Array>
  getThumb(track: Track): Promise<Blob | null>
}

let cached: Promise<Backend> | null = null
export function backend(): Promise<Backend> {
  cached ??= import.meta.env.DEV && isDemo
    ? import('./demo').then((m) => m.demoBackend)
    : import('./telegram').then((m) => m.telegramBackend)
  return cached
}
