/* Service worker d'Onde.
 * Rôle : répondre aux requêtes du lecteur audio (…/stream/<morceau>) en
 * demandant à la page les octets voulus. La page les télécharge par blocs
 * depuis Telegram. Rien n'est envoyé ailleurs que chez Telegram. */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

const scopePath = new URL(self.registration.scope).pathname
const STREAM_PREFIX = scopePath + 'stream/'

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith(STREAM_PREFIX)) {
    const key = decodeURIComponent(url.pathname.slice(STREAM_PREFIX.length))
    event.respondWith(handleStream(event, key))
    return
  }
  if (event.request.method !== 'GET' || !url.pathname.startsWith(scopePath)) return
  const rest = url.pathname.slice(scopePath.length)
  // Page d'accueil : réseau d'abord (pour recevoir les mises à jour), copie locale sinon.
  if (event.request.mode === 'navigate' || rest === '' || rest === 'index.html') {
    event.respondWith(pageFirstNetwork(event.request))
    return
  }
  // Fichiers de l'appli (noms uniques à chaque version) : copie locale d'abord.
  if (rest.startsWith('assets/') || rest.startsWith('icons/') || rest === 'manifest.webmanifest') {
    event.respondWith(cacheFirst(event.request))
  }
})

// ---------- Ouverture de l'appli sans réseau ----------

const SHELL = 'onde-shell-v1'
const INDEX_URL = self.registration.scope

async function pageFirstNetwork(request) {
  const cache = await caches.open(SHELL)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 4000)
    const response = await fetch(INDEX_URL, { signal: controller.signal, cache: 'no-cache' })
    clearTimeout(timer)
    if (response.ok) await cache.put(INDEX_URL, response.clone())
    return response
  } catch (err) {
    return (await cache.match(INDEX_URL)) || fetch(request)
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL)
  const hit = await cache.match(request.url)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok) cache.put(request.url, response.clone()).catch(() => {})
  return response
}

// La page envoie la liste de ses fichiers : on les met en réserve et on retire ceux des anciennes versions.
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'onde-shell' || !Array.isArray(data.urls)) return
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL)
      const wanted = new Set(data.urls)
      for (const url of wanted) {
        if (!(await cache.match(url))) {
          try {
            const response = await fetch(url, { cache: 'no-cache' })
            if (response.ok) await cache.put(url, response)
          } catch (err) {
            /* hors ligne : on réessaiera au prochain lancement */
          }
        }
      }
      for (const request of await cache.keys()) {
        if (request.url.includes('/assets/') && !wanted.has(request.url)) await cache.delete(request)
      }
    })(),
  )
})

async function pickClient(event) {
  if (event.clientId) {
    const c = await self.clients.get(event.clientId)
    if (c) return c
  }
  const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  return all.find((c) => c.visibilityState === 'visible') || all[0]
}

function askPage(client, message, timeoutMs) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timer = setTimeout(() => reject(new Error('timeout')), timeoutMs)
    channel.port1.onmessage = (e) => {
      clearTimeout(timer)
      resolve(e.data)
    }
    client.postMessage(message, [channel.port2])
  })
}

async function handleStream(event, key) {
  try {
    const range = /bytes=(\d+)-(\d*)/.exec(event.request.headers.get('range') || '')
    const start = range ? Number(range[1]) : 0
    const end = range && range[2] !== '' ? Number(range[2]) : null

    const client = await pickClient(event)
    if (!client) return new Response('Aucune page ouverte', { status: 503 })

    const reply = await askPage(client, { type: 'onde-range', key, start, end }, 45000)
    if (!reply || !reply.ok) {
      return new Response((reply && reply.error) || 'Erreur', { status: (reply && reply.status) || 500 })
    }
    const length = reply.buffer.byteLength
    return new Response(reply.buffer, {
      status: 206,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${reply.start}-${reply.start + length - 1}/${reply.total}`,
        'Content-Length': String(length),
        'Content-Type': reply.mime || 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return new Response(String(err), { status: 504 })
  }
}
