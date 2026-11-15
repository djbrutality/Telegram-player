// Indexation progressive des groupes choisis.
// On lit les fichiers audio par pages de 100, en enregistrant après chaque page :
// si l'appli est fermée en cours de route, on reprend là où on s'était arrêté.
import { getIndexState, putIndexState, putTracks, deleteChatData } from '../lib/db'
import { sleep } from '../lib/format'
import { addToSearchIndex, resetSearchIndex } from '../lib/searchIndex'
import type { ChatInfo, IndexState } from '../lib/types'
import { bumpLibrary, setProgress, useApp } from '../store'
import { backend } from './backend'
import { frenchError } from './client'

const PAGE = 100
const PAUSE_MS = 350 // petite pause entre deux pages pour ménager Telegram

let generation = 0
let running = false
let lastRun = 0

/** Au retour dans l'appli : cherche les nouveautés si la dernière vérification date de plus de 10 minutes. */
export function refreshIfStale() {
  if (!running && Date.now() - lastRun > 10 * 60 * 1000) startIndexing()
}

/** (Re)lance l'indexation de tous les groupes choisis. */
export function startIndexing() {
  generation++
  if (!running) void loop()
}

export function stopIndexing() {
  generation++
}

export async function reindexAll() {
  stopIndexing()
  for (const c of useApp.getState().chats) {
    await deleteChatData(c.id)
    setProgress(c.id, { count: 0, total: 0, complete: false, error: undefined })
  }
  resetSearchIndex()
  bumpLibrary(true)
  startIndexing()
}

async function loop() {
  running = true
  try {
    let gen: number
    do {
      gen = generation
      for (const chat of useApp.getState().chats) {
        if (gen !== generation) break
        setProgress(chat.id, { busy: true, error: undefined })
        try {
          await indexChat(chat, () => gen !== generation)
        } catch (err) {
          setProgress(chat.id, { error: frenchError(err) })
        }
        setProgress(chat.id, { busy: false })
      }
      // Second passage, une fois tous les groupes parcourus : l'historique ancien que le filtre
      // Musique de Telegram ne renvoie pas (constaté sur des canaux créés avant fin 2020).
      for (const chat of useApp.getState().chats) {
        if (gen !== generation) break
        try {
          await deepScan(chat, () => gen !== generation)
        } catch (err) {
          setProgress(chat.id, { error: frenchError(err) })
        }
        setProgress(chat.id, { busy: false, deep: false })
      }
    } while (gen !== generation)
  } finally {
    running = false
    lastRun = Date.now()
    bumpLibrary(true)
  }
}

async function indexChat(chat: ChatInfo, cancelled: () => boolean) {
  const api = await backend()
  const state: IndexState = (await getIndexState(chat.id)) ?? {
    chatId: chat.id,
    newestId: 0,
    oldestId: 0,
    complete: false,
    count: 0,
    total: 0,
    updatedAt: 0,
  }
  const save = async () => {
    state.updatedAt = Date.now()
    await putIndexState({ ...state })
    setProgress(chat.id, { count: state.count, total: Math.max(state.total, state.count), complete: state.complete })
    bumpLibrary()
  }

  // 1) Nouveautés : tout ce qui a été publié depuis la dernière visite.
  if (state.newestId > 0 || state.complete) {
    let offsetId = 0
    let top = state.newestId
    for (;;) {
      if (cancelled()) return
      const page = await api.searchAudio(chat, { offsetId, minId: state.newestId, limit: PAGE })
      if (page.rawCount === 0) break
      await putTracks(page.tracks)
      addToSearchIndex(page.tracks)
      state.count += page.tracks.length
      state.total = Math.max(state.total, state.count)
      top = Math.max(top, page.maxId)
      offsetId = page.minId
      await sleep(PAUSE_MS)
    }
    state.newestId = top
    await save()
  }

  // 2) Historique : on remonte dans le passé jusqu'au premier message.
  while (!state.complete) {
    if (cancelled()) return
    const page = await api.searchAudio(chat, { offsetId: state.oldestId, minId: 0, limit: PAGE })
    if (page.rawCount === 0) {
      state.complete = true
    } else {
      await putTracks(page.tracks)
      addToSearchIndex(page.tracks)
      state.count += page.tracks.length
      state.total = Math.max(page.total, state.count)
      state.oldestId = page.minId
      state.newestId = Math.max(state.newestId, page.maxId)
    }
    await save()
    if (!state.complete) await sleep(PAUSE_MS)
  }
  if (state.complete) {
    state.total = state.count
    await save()
  }
}

/**
 * Relit l'historique complet en dessous du plus ancien morceau trouvé par le filtre Musique,
 * message par message, et garde les fichiers audio. Reprend où il s'était arrêté.
 */
async function deepScan(chat: ChatInfo, cancelled: () => boolean) {
  const state = await getIndexState(chat.id)
  if (!state?.complete || state.deepComplete) return
  const api = await backend()
  setProgress(chat.id, { busy: true, deep: true, error: undefined })
  let offsetId = state.deepOldestId ?? state.oldestId
  for (;;) {
    if (cancelled()) return
    // offsetId 0 = partir du message le plus récent (aucun morceau trouvé par le filtre).
    const page = offsetId === 1 ? null : await api.historyPage(chat, offsetId, PAGE)
    if (!page || page.rawCount === 0) {
      state.deepComplete = true
    } else {
      if (page.tracks.length) {
        await putTracks(page.tracks)
        addToSearchIndex(page.tracks)
        state.count += page.tracks.length
        state.total = state.count
      }
      offsetId = page.minId
      state.deepOldestId = offsetId
    }
    state.updatedAt = Date.now()
    await putIndexState({ ...state })
    setProgress(chat.id, { count: state.count, total: state.count, complete: true })
    if (page?.tracks.length) bumpLibrary()
    if (state.deepComplete) return
    await sleep(PAUSE_MS)
  }
}
