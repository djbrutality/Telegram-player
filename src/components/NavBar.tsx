import { Icon } from './Icon'

export type Tab = 'home' | 'search' | 'favorites' | 'groups'

const tabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'Accueil', icon: 'home' },
  { id: 'search', label: 'Recherche', icon: 'search' },
  { id: 'favorites', label: 'Favoris', icon: 'heart' },
  { id: 'groups', label: 'Groupes', icon: 'groups' },
]

export function NavBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="nav">
      {tabs.map((t) => (
        <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => onChange(t.id)}>
          <Icon name={t.icon} size={23} />
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}
