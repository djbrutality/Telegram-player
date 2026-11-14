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
  if (url.origin !== self.location.origin || !url.pathname.startsWith(STREAM_PREFIX)) return
  const key = decodeURIComponent(url.pathname.slice(STREAM_PREFIX.length))
  event.respondWith(handleStream(event, key))
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
