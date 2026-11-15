// Implémentation réelle : appels à l'API Telegram.
import { Api } from 'telegram'
import { FileMigrateError } from 'telegram/errors'
import bigInt from 'big-integer'
import type { Buffer as BufferType } from 'buffer'
import type { ChatInfo, Track } from '../lib/types'
import { db, putTracks } from '../lib/db'
import type { AudioPage, Backend } from './backend'
import { call, ready } from './client'

// Buffer global fourni par le polyfill : c'est celui que GramJS reconnaît.
declare const Buffer: typeof BufferType

function inputPeer(chat: ChatInfo): Api.TypeInputPeer {
  return chat.kind === 'channel'
    ? new Api.InputPeerChannel({ channelId: bigInt(chat.id), accessHash: bigInt(chat.accessHash || '0') })
    : new Api.InputPeerChat({ chatId: bigInt(chat.id) })
}

function parseTrack(chat: ChatInfo, msg: Api.TypeMessage): Track | null {
  if (!(msg instanceof Api.Message)) return null
  const media = msg.media
  if (!(media instanceof Api.MessageMediaDocument)) return null
  const doc = media.document
  if (!(doc instanceof Api.Document)) return null

  let audio: Api.DocumentAttributeAudio | undefined
  let fileName: string | undefined
  for (const a of doc.attributes) {
    if (a instanceof Api.DocumentAttributeAudio) audio = a
    else if (a instanceof Api.DocumentAttributeFilename) fileName = a.fileName
  }
  if (audio?.voice) return null
  if (!audio && !doc.mimeType.startsWith('audio/')) return null

  // Plus grande miniature disponible (pochette), si le fichier en contient une.
  let thumbType: string | undefined
  let best = 0
  for (const t of doc.thumbs ?? []) {
    if (t instanceof Api.PhotoSize && t.w >= best) {
      best = t.w
      thumbType = t.type
    } else if (t instanceof Api.PhotoSizeProgressive && t.w >= best) {
      best = t.w
      thumbType = t.type
    }
  }

  return {
    key: `${chat.id}_${msg.id}`,
    chatId: chat.id,
    msgId: msg.id,
    docId: doc.id.toString(),
    accessHash: doc.accessHash.toString(),
    fileRef: new Uint8Array(doc.fileReference),
    dcId: doc.dcId,
    size: doc.size.toJSNumber(),
    mime: doc.mimeType,
    title: audio?.title || undefined,
    performer: audio?.performer || undefined,
    duration: audio?.duration ?? 0,
    fileName,
    date: msg.date,
    thumbType,
  }
}

async function rawGetFile(track: Track, offset: number, limit: number, thumbSize: string): Promise<Uint8Array> {
  const c = await ready()
  const request = new Api.upload.GetFile({
    location: new Api.InputDocumentFileLocation({
      id: bigInt(track.docId),
      accessHash: bigInt(track.accessHash),
      fileReference: Buffer.from(track.fileRef),
      thumbSize,
    }),
    offset: bigInt(offset),
    limit,
  })
  let result
  try {
    result = await c.invokeWithSender(request, await c.getSender(track.dcId))
  } catch (err) {
    if (!(err instanceof FileMigrateError)) throw err
    track.dcId = err.newDc
    result = await c.invokeWithSender(request, await c.getSender(err.newDc))
  }
  if (!(result instanceof Api.upload.File)) throw new Error('Fichier servi par CDN : non pris en charge')
  return new Uint8Array(result.bytes)
}

/** Les « références de fichier » Telegram expirent : on relit le message pour en obtenir une neuve. */
async function refreshReference(track: Track) {
  const chat = await (await db()).get('chats', track.chatId)
  if (!chat) throw new Error('Groupe introuvable')
  const c = await ready()
  const id = [new Api.InputMessageID({ id: track.msgId })]
  const res =
    chat.kind === 'channel'
      ? await c.invoke(
          new Api.channels.GetMessages({
            channel: new Api.InputChannel({ channelId: bigInt(chat.id), accessHash: bigInt(chat.accessHash || '0') }),
            id,
          }),
        )
      : await c.invoke(new Api.messages.GetMessages({ id }))
  const msg = 'messages' in res ? res.messages[0] : undefined
  const fresh = msg ? parseTrack(chat, msg) : null
  if (!fresh) throw new Error('Ce morceau a été supprimé du groupe')
  track.fileRef = fresh.fileRef
  track.dcId = fresh.dcId
  track.accessHash = fresh.accessHash
  await putTracks([{ ...track }])
}

async function getFileSafe(track: Track, offset: number, limit: number, thumbSize: string) {
  return call(async () => {
    try {
      return await rawGetFile(track, offset, limit, thumbSize)
    } catch (err) {
      const code = (err as { errorMessage?: string }).errorMessage || ''
      if (!/FILE_REFERENCE/.test(code)) throw err
      await refreshReference(track)
      return rawGetFile(track, offset, limit, thumbSize)
    }
  })
}

export const telegramBackend: Backend = {
  async listChats() {
    const c = await ready()
    const dialogs = await call(() => c.getDialogs({}))
    const out: ChatInfo[] = []
    for (const d of dialogs) {
      const e = d.entity
      if (e instanceof Api.Channel) {
        out.push({
          id: e.id.toString(),
          kind: 'channel',
          accessHash: e.accessHash?.toString(),
          title: e.title,
          broadcast: !!e.broadcast,
        })
      } else if (e instanceof Api.Chat && !e.deactivated && !e.left && !e.migratedTo) {
        out.push({ id: e.id.toString(), kind: 'chat', title: e.title, broadcast: false })
      }
    }
    return out
  },

  async searchAudio(chat, { offsetId, minId, limit }): Promise<AudioPage> {
    const c = await ready()
    const res = await call(() =>
      c.invoke(
        new Api.messages.Search({
          peer: inputPeer(chat),
          q: '',
          filter: new Api.InputMessagesFilterMusic(),
          minDate: 0,
          maxDate: 0,
          offsetId,
          addOffset: 0,
          limit,
          maxId: 0,
          minId,
          hash: bigInt(0),
        }),
      ),
    )
    if (res instanceof Api.messages.MessagesNotModified) {
      return { tracks: [], rawCount: 0, minId: 0, maxId: 0, total: 0 }
    }
    const tracks: Track[] = []
    let lo = Infinity
    let hi = 0
    for (const m of res.messages) {
      lo = Math.min(lo, m.id)
      hi = Math.max(hi, m.id)
      const t = parseTrack(chat, m)
      if (t) tracks.push(t)
    }
    const total = 'count' in res ? res.count : res.messages.length
    return { tracks, rawCount: res.messages.length, minId: isFinite(lo) ? lo : 0, maxId: hi, total }
  },

  getFile: (track, offset, limit) => getFileSafe(track, offset, limit, ''),

  async getThumb(track) {
    if (!track.thumbType) return null
    const bytes = await getFileSafe(track, 0, 512 * 1024, track.thumbType)
    return bytes.length ? new Blob([bytes as BlobPart], { type: 'image/jpeg' }) : null
  },
}
