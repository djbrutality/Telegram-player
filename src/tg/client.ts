// Connexion à Telegram depuis le navigateur (GramJS / MTProto).
// Les identifiants et la session ne quittent jamais le téléphone :
// ils sont rangés dans le stockage local de Safari, pour ce site uniquement.
import { Api, TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import { FloodWaitError } from 'telegram/errors'
import { sleep } from '../lib/format'
import { useApp } from '../store'

const K_ID = 'onde.apiId'
const K_HASH = 'onde.apiHash'
const K_SESSION = 'onde.session'

/** Mode démonstration (développement uniquement) : faux Telegram pour tester l'interface. */
export const isDemo = import.meta.env.DEV && new URLSearchParams(location.search).has('demo')

let client: TelegramClient | null = null
let connecting: Promise<unknown> | null = null

export function getCreds() {
  const apiId = Number(localStorage.getItem(K_ID))
  const apiHash = localStorage.getItem(K_HASH) || ''
  return apiId && apiHash ? { apiId, apiHash } : null
}
export function saveCreds(apiId: number, apiHash: string) {
  localStorage.setItem(K_ID, String(apiId))
  localStorage.setItem(K_HASH, apiHash)
}
export function clearCreds() {
  localStorage.removeItem(K_ID)
  localStorage.removeItem(K_HASH)
  localStorage.removeItem(K_SESSION)
  client = null
}
export function hasSession() {
  return isDemo || (!!getCreds() && !!localStorage.getItem(K_SESSION))
}

function makeClient() {
  const creds = getCreds()
  if (!creds) throw new Error('Identifiants manquants')
  const c = new TelegramClient(new StringSession(localStorage.getItem(K_SESSION) || ''), creds.apiId, creds.apiHash, {
    connectionRetries: 5,
    useWSS: true,
    deviceModel: 'iPhone',
    systemVersion: 'iOS',
    appVersion: 'Onde 1.0',
    langCode: 'fr',
    systemLangCode: 'fr',
    // Les petites pauses (≤ 5 s) sont gérées en silence ; les autres passent par call() ci-dessous.
    floodSleepThreshold: 5,
  })
  c.setLogLevel('error' as never)
  return c
}

/** Connexion avec délai maximal : sans réseau, on abandonne au lieu d'attendre indéfiniment. */
async function open(c: TelegramClient) {
  if (c.connected) return
  let timer: number | undefined
  try {
    await Promise.race([
      c.connect(),
      new Promise((_, reject) => (timer = window.setTimeout(() => reject(new Error('timeout de connexion')), 20000))),
    ])
  } catch (err) {
    if (client === c) client = null
    c.destroy().catch(() => {})
    throw err
  } finally {
    clearTimeout(timer)
  }
}

/** Ouvre la connexion. Renvoie true si la session enregistrée est toujours valide. */
export async function connect(): Promise<boolean> {
  client ??= makeClient()
  await open(client)
  return client.checkAuthorization()
}

/** Client prêt à l'emploi (reconnecte si iOS a coupé le réseau en arrière-plan). */
export async function ready(): Promise<TelegramClient> {
  if (!client && getCreds() && localStorage.getItem(K_SESSION)) client = makeClient()
  if (!client) throw new Error('Non connecté à Telegram')
  const c = client
  if (!c.connected) {
    connecting ??= open(c).finally(() => (connecting = null))
    await connecting
  }
  return c
}

export type LoginStep = 'phone' | 'code' | 'password'
/** L'interface fournit cette fonction : elle affiche l'étape et renvoie la saisie. */
export type Ask = (step: LoginStep, error?: string) => Promise<string>

export async function login(ask: Ask) {
  client ??= makeClient()
  await open(client)
  let lastError: string | undefined
  const take = () => {
    const e = lastError
    lastError = undefined
    return e
  }
  await client.start({
    phoneNumber: () => ask('phone', take()),
    phoneCode: () => ask('code', take()),
    password: () => ask('password', take()),
    onError: async (err) => {
      lastError = frenchError(err)
      return false
    },
  })
  localStorage.setItem(K_SESSION, client.session.save() as unknown as string)
}

export async function getMyName(): Promise<string> {
  const me = await (await ready()).getMe()
  return [me.firstName, me.lastName].filter(Boolean).join(' ') || me.username || 'Moi'
}

/** Ferme la session côté Telegram (elle disparaît de « Appareils »). */
export async function logoutRemote() {
  if (!client) return
  try {
    await client.invoke(new Api.auth.LogOut())
  } catch {
    /* hors ligne : on efface quand même tout en local */
  }
  try {
    await client.destroy()
  } catch {
    /* rien */
  }
  client = null
}

/**
 * Exécute un appel Telegram en respectant les limites de débit :
 * si Telegram répond FLOOD_WAIT, on affiche un compte à rebours, on attend, puis on réessaie.
 */
export async function call<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof FloodWaitError && attempt < 6 && err.seconds <= 900) {
        const ms = (err.seconds + 1) * 1000
        useApp.setState({ floodUntil: Date.now() + ms })
        await sleep(ms)
        useApp.setState({ floodUntil: 0 })
        continue
      }
      throw err
    }
  }
}

export function frenchError(err: unknown): string {
  const e = err as { errorMessage?: string; seconds?: number; message?: string }
  const code = e?.errorMessage || e?.message || String(err)
  if (err instanceof FloodWaitError || /FLOOD/.test(code)) {
    const s = e.seconds ?? 0
    const wait = s >= 3600 ? `${Math.ceil(s / 3600)} h` : s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`
    return `Trop de tentatives. Telegram demande d'attendre ${wait}.`
  }
  const map: Record<string, string> = {
    API_ID_INVALID: 'api_id ou api_hash incorrect. Vérifiez-les sur my.telegram.org.',
    API_ID_PUBLISHED_FLOOD: 'Cet api_id est bloqué par Telegram. Créez-en un nouveau.',
    PHONE_NUMBER_INVALID: 'Numéro invalide. Utilisez le format international, ex. +33612345678.',
    PHONE_NUMBER_BANNED: 'Ce numéro est bloqué par Telegram.',
    PHONE_CODE_INVALID: 'Code incorrect. Réessayez.',
    PHONE_CODE_EXPIRED: 'Code expiré. Revenez en arrière pour en demander un nouveau.',
    PHONE_CODE_EMPTY: 'Saisissez le code reçu.',
    PASSWORD_HASH_INVALID: 'Mot de passe incorrect.',
    'Code is empty': 'Saisissez le code reçu.',
    'Password is empty': 'Saisissez votre mot de passe.',
    AUTH_KEY_UNREGISTERED: 'Session expirée. Reconnectez-vous.',
  }
  if (map[code]) return map[code]
  if (/network|socket|connect|timeout/i.test(code)) return 'Problème de connexion Internet. Réessayez.'
  return `Erreur Telegram : ${code}`
}
