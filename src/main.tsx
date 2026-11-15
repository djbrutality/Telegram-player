import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

// Sur iOS, une web app installée annonce parfois une hauteur d'écran trop courte
// (il manque la hauteur de la zone de l'encoche), ce qui laisse une bande vide en bas.
// En mode installé, l'appli occupe tout l'écran : on impose donc sa hauteur réelle.
function fitScreen() {
  // « navigator.standalone » n'existe que sur iOS : sur Android, la hauteur annoncée est déjà juste,
  // et imposer celle de l'écran ferait passer la barre de navigation sous les boutons du système.
  const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true
  const root = document.documentElement
  if (!standalone) return root.style.removeProperty('--app-h')
  const portrait = window.innerHeight >= window.innerWidth
  const full = portrait ? Math.max(screen.height, screen.width) : Math.min(screen.height, screen.width)
  root.style.setProperty('--app-h', `${Math.max(full, window.innerHeight)}px`)
}
fitScreen()
window.addEventListener('resize', fitScreen)
window.addEventListener('orientationchange', () => setTimeout(fitScreen, 300))

createRoot(document.getElementById('root')!).render(<App />)
