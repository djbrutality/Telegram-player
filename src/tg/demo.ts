// Faux Telegram, utilisé uniquement en développement (adresse terminée par ?demo).
// Il fabrique des groupes, des morceaux (un simple son) et des pochettes colorées.
import type { ChatInfo, Track } from '../lib/types'
import { sleep } from '../lib/format'
import type { Backend } from './backend'

const chats: ChatInfo[] = [
  { id: '101', kind: 'channel', accessHash: '1', title: 'Vinyles du dimanche', broadcast: true },
  { id: '102', kind: 'channel', accessHash: '1', title: 'Électro & nuits blanches', broadcast: false },
  { id: '103', kind: 'chat', title: 'Famille – partages', broadcast: false },
  { id: '104', kind: 'channel', accessHash: '1', title: 'Jazz, soul & autres trésors', broadcast: true },
]
const counts: Record<string, number> = { '101': 260, '102': 48, '103': 0, '104': 7 }
const artists = ['Les Marées', 'Nora Vell', 'Atelier 9', 'Sable Noir', 'Camille Orsay', 'Kōda']
const words = ['Lueur', 'Rivage', 'Minuit', 'Poussière', 'Orage', 'Velours', 'Signal', 'Automne', 'Néon', 'Écume']

function makeTrack(chatId: string, n: number): Track {
  const plain = n % 7 === 3
  const seconds = 20 + (n % 5) * 6
  return {
    key: `${chatId}_${n}`,
    chatId,
    msgId: n,
    docId: String(n),
    accessHash: '1',
    fileRef: new Uint8Array(),
    dcId: 2,
    size: 44 + seconds * 22050 * 2,
    mime: 'audio/wav',
    title: plain ? undefined : `${words[n % words.length]} ${words[(n * 3 + 1) % words.length].toLowerCase()}`,
    performer: plain ? undefined : artists[n % artists.length],
    duration: seconds,
    fileName: `piste_${String(n).padStart(3, '0')}.wav`,
    date: 1_760_000_000 + n * 3600 + Number(chatId),
    thumbType: n % 3 === 0 ? undefined : 'm',
  }
}

const wavCache = new Map<string, Uint8Array>()
function wav(track: Track): Uint8Array {
  let w = wavCache.get(track.key)
  if (w) return w
  const samples = (track.size - 44) / 2
  w = new Uint8Array(track.size)
  const v = new DataView(w.buffer)
  const str = (o: number, s: string) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)))
  str(0, 'RIFF'); v.setUint32(4, track.size - 8, true); str(8, 'WAVEfmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, 22050, true); v.setUint32(28, 44100, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  str(36, 'data'); v.setUint32(40, samples * 2, true)
  const f = 220 + (track.msgId % 12) * 30
  for (let i = 0; i < samples; i++) {
    const t = i / 22050
    const env = 0.5 + 0.5 * Math.sin(t * 3)
    v.setInt16(44 + i * 2, Math.sin(2 * Math.PI * f * t) * env * 6000, true)
  }
  wavCache.clear()
  wavCache.set(track.key, w)
  return w
}

export const demoBackend: Backend = {
  async listChats() {
    await sleep(300)
    return chats
  },
  async searchAudio(chat, { offsetId, minId, limit }) {
    await sleep(250)
    const total = counts[chat.id] ?? 0
    const from = offsetId ? offsetId - 1 : total
    const tracks: Track[] = []
    for (let n = from; n > minId && n >= 1 && tracks.length < limit; n--) tracks.push(makeTrack(chat.id, n))
    return {
      tracks,
      rawCount: tracks.length,
      minId: tracks.length ? tracks[tracks.length - 1].msgId : 0,
      maxId: tracks.length ? tracks[0].msgId : 0,
      total,
    }
  },
  async getFile(track, offset, limit) {
    await sleep(120)
    return wav(track).slice(offset, offset + limit)
  },
  async getThumb(track) {
    if (!track.thumbType) return null
    const c = document.createElement('canvas')
    c.width = c.height = 160
    const g = c.getContext('2d')!
    const h = (track.msgId * 47) % 360
    const grad = g.createLinearGradient(0, 0, 160, 160)
    grad.addColorStop(0, `hsl(${h} 70% 55%)`)
    grad.addColorStop(1, `hsl(${(h + 70) % 360} 60% 25%)`)
    g.fillStyle = grad
    g.fillRect(0, 0, 160, 160)
    g.fillStyle = 'rgba(255,255,255,.85)'
    g.beginPath(); g.arc(80, 80, 34, 0, 7); g.fill()
    return new Promise((r) => c.toBlob((b) => r(b), 'image/jpeg', 0.8))
  },
  async saveBackup(json) {
    await sleep(400)
    sessionStorage.setItem('demo.backup', JSON.stringify({ json, date: Math.floor(Date.now() / 1000) }))
  },
  async loadBackup() {
    await sleep(300)
    return JSON.parse(sessionStorage.getItem('demo.backup') || 'null')
  },
}
