/** Un groupe ou canal Telegram. */
export interface ChatInfo {
  id: string
  kind: 'channel' | 'chat'
  accessHash?: string
  title: string
  /** true = canal de diffusion, false = groupe */
  broadcast: boolean
  /** identifiant public (sans @), s'il existe */
  username?: string
}

/** Un fichier audio trouvé dans un groupe. */
export interface Track {
  /** identifiant unique : "<groupe>_<message>" */
  key: string
  chatId: string
  msgId: number
  docId: string
  accessHash: string
  fileRef: Uint8Array
  dcId: number
  size: number
  mime: string
  title?: string
  performer?: string
  duration: number
  fileName?: string
  /** date du message (secondes) */
  date: number
  /** type de miniature Telegram ("m", "x"…) si le fichier a une pochette */
  thumbType?: string
}

/** Avancement de l'indexation d'un groupe. */
export interface IndexState {
  chatId: string
  newestId: number
  oldestId: number
  complete: boolean
  count: number
  total: number
  updatedAt: number
}

export type PlaybackMode = 'auto' | 'stream' | 'full'
