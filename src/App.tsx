import { useEffect, useState } from 'react'
import { MiniPlayer } from './components/MiniPlayer'
import { NavBar, type Tab } from './components/NavBar'
import { getAllIndexStates, getSelectedChats, setSelectedChats } from './lib/db'
import type { ChatInfo } from './lib/types'
import { initMediaSession } from './player/mediaSession'
import { restorePlayer } from './player/player'
import { initStreaming } from './player/stream'
import { Dialog } from './components/Dialog'
import { TrackMenu } from './components/TrackMenu'
import { applyBackup, hasPendingBackup, markDirty, runBackup } from './lib/backup'
import { loadUserData } from './lib/userdata'
import { Diagnostic } from './screens/Diagnostic'
import { Favorites } from './screens/Favorites'
import { Restore } from './screens/Restore'
import { Search } from './screens/Search'
import { Player } from './screens/Player'
import { ChatPicker } from './screens/ChatPicker'
import { GroupView } from './screens/GroupView'
import { Groups } from './screens/Groups'
import { Home } from './screens/Home'
import { Login } from './screens/Login'
import { Settings } from './screens/Settings'
import { bumpLibrary, setProgress, useApp, useUi } from './store'
import { connect, getMyName, hasSession, isDemo } from './tg/client'
import { refreshIfStale, startIndexing, stopIndexing } from './tg/indexer'
import { resetSearchIndex } from './lib/searchIndex'

/** Connexion en arrière-plan : l'appli s'ouvre tout de suite avec l'index déjà enregistré. */
async function goOnline() {
  useApp.setState({ net: 'connecting' })
  try {
    if (!isDemo) {
      const authorized = await connect()
      if (!authorized) {
        stopIndexing()
        useApp.setState({ phase: 'login', loginNotice: 'Votre session a expiré. Reconnectez-vous.' })
        return
      }
      getMyName().then((name) => useApp.setState({ me: { name } }), () => {})
    } else {
      useApp.setState({ me: { name: 'Démonstration' } })
    }
    useApp.setState({ net: 'online' })
    if (useApp.getState().chats.length) startIndexing()
    // Une sauvegarde n'avait pas pu partir (appli fermée, hors ligne) : on l'envoie maintenant.
    if (hasPendingBackup() && useApp.getState().phase === 'main') void runBackup()
  } catch {
    useApp.setState({ net: 'offline' })
  }
}

async function boot() {
  await initStreaming()
  if (!hasSession()) {
    useApp.setState({ phase: 'login' })
    return
  }
  const chats = await getSelectedChats()
  for (const s of await getAllIndexStates()) {
    setProgress(s.chatId, { count: s.count, total: s.total, complete: s.complete })
  }
  await loadUserData()
  await restorePlayer()
  initMediaSession()
  useApp.setState({ chats, phase: chats.length ? 'main' : 'pick' })
  void goOnline()
}

async function applySelection(chats: ChatInfo[]) {
  stopIndexing()
  await setSelectedChats(chats)
  resetSearchIndex()
  useApp.setState({ chats: await getSelectedChats(), phase: 'main' })
  bumpLibrary(true)
  startIndexing()
  markDirty()
}

function FloodBanner() {
  const until = useApp((s) => s.floodUntil)
  const [, tick] = useState(0)
  useEffect(() => {
    if (!until) return
    const t = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [until])
  const left = Math.ceil((until - Date.now()) / 1000)
  if (!until || left <= 0) return null
  return <div className="banner">Telegram demande une pause : reprise dans {left} s</div>
}

function Toast() {
  const message = useUi((s) => s.toast)
  return message ? <div className="toast">{message}</div> : null
}

export function App() {
  const phase = useApp((s) => s.phase)
  const net = useApp((s) => s.net)
  const [tab, setTab] = useState<Tab>('home')
  const [openChat, setOpenChat] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<'settings' | 'picker' | 'diag' | null>(null)

  useEffect(() => {
    void boot()
    // Au retour au premier plan, on relance la connexion si iOS l'avait coupée.
    const wake = () => {
      const { phase, net } = useApp.getState()
      if (document.visibilityState !== 'visible' || phase !== 'main') return
      if (net === 'offline') void goOnline()
      else if (net === 'online') refreshIfStale() // nouveaux morceaux publiés entre-temps
    }
    document.addEventListener('visibilitychange', wake)
    window.addEventListener('online', wake)
    return () => {
      document.removeEventListener('visibilitychange', wake)
      window.removeEventListener('online', wake)
    }
  }, [])

  if (phase === 'boot') {
    return (
      <div className="app center-block full">
        <span className="spinner" />
        <p className="muted small boot-note">Préparation de la bibliothèque…</p>
      </div>
    )
  }

  if (phase === 'login') {
    return (
      <div className="app">
        <Login
          onDone={() => {
            useApp.setState({ phase: 'restore', loginNotice: null })
            void goOnline()
          }}
        />
      </div>
    )
  }

  if (phase === 'restore') {
    return (
      <div className="app">
        <FloodBanner />
        <Restore
          onSkip={() => useApp.setState({ phase: 'pick' })}
          onRestore={async (backup) => {
            await applyBackup(backup)
            useApp.setState({ chats: await getSelectedChats(), phase: backup.chats.length ? 'main' : 'pick' })
            bumpLibrary(true)
            startIndexing()
          }}
        />
      </div>
    )
  }

  if (phase === 'pick' || overlay === 'picker') {
    return (
      <div className="app">
        <FloodBanner />
        <ChatPicker
          onCancel={phase === 'main' ? () => setOverlay('settings') : undefined}
          onDone={(chats) => {
            setOverlay(null)
            setOpenChat(null)
            setTab('groups')
            void applySelection(chats)
          }}
        />
      </div>
    )
  }

  let screen
  if (overlay === 'settings') {
    screen = <Settings onBack={() => setOverlay(null)} onEditChats={() => setOverlay('picker')} onDiagnostic={() => setOverlay('diag')} />
  } else if (overlay === 'diag') {
    screen = <Diagnostic onBack={() => setOverlay('settings')} />
  } else if (tab === 'groups' && openChat) {
    screen = <GroupView chatId={openChat} onBack={() => setOpenChat(null)} />
  } else if (tab === 'groups') {
    screen = <Groups onOpen={setOpenChat} onEdit={() => setOverlay('picker')} />
  } else if (tab === 'home') {
    screen = <Home onSettings={() => setOverlay('settings')} onGroups={() => setTab('groups')} />
  } else if (tab === 'search') {
    screen = <Search />
  } else {
    screen = <Favorites />
  }

  return (
    <div className="app">
      <FloodBanner />
      {net === 'offline' && <div className="banner quiet">Hors ligne — nouvelle tentative au retour du réseau</div>}
      {screen}
      <MiniPlayer />
      <Player />
      <TrackMenu />
      <Dialog />
      <Toast />
      <NavBar
        tab={tab}
        onChange={(t) => {
          useUi.setState({ playerOpen: false })
          setOverlay(null)
          if (t === tab) setOpenChat(null)
          setTab(t)
        }}
      />
    </div>
  )
}
