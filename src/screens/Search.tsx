import { useEffect, useMemo, useState } from 'react'
import { ROW_HEIGHT, TrackRow } from '../components/TrackRow'
import { VirtualList } from '../components/VirtualList'
import { fold, trackArtist, trackTitle } from '../lib/format'
import { useAllTracks } from '../lib/library'
import { useUser } from '../lib/userdata'
import { playList, usePlayer } from '../player/player'

/** Recherche par titre et artiste dans tous les groupes choisis. */
export function Search() {
  const all = useAllTracks()
  const metaVersion = useUser((s) => s.metaVersion)
  const currentKey = usePlayer((s) => s.current?.key)
  const playing = usePlayer((s) => s.playing)
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')

  // On attend une courte pause dans la frappe avant de chercher.
  useEffect(() => {
    const t = setTimeout(() => setQuery(text), 180)
    return () => clearTimeout(t)
  }, [text])

  // Texte de recherche de chaque morceau : titre, artiste et nom de fichier, sans accents.
  const index = useMemo(
    () => (all ?? []).map((t) => ({ t, hay: fold(`${trackTitle(t)} ${trackArtist(t)} ${t.fileName ?? ''}`) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, metaVersion],
  )

  const results = useMemo(() => {
    const words = fold(query).split(/\s+/).filter(Boolean)
    if (!words.length) return null
    return index
      .filter((e) => words.every((w) => e.hay.includes(w)))
      .map((e) => e.t)
      .sort((a, b) => b.date - a.date)
  }, [index, query])

  return (
    <div className="scroll">
      <header className="topbar">
        <h1>Recherche</h1>
      </header>
      <div className="pad sticky-search">
        <input
          type="search"
          placeholder="Titre, artiste…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          enterKeyHint="search"
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
      {!results && (
        <p className="muted pad">
          {all ? `Cherchez parmi ${all.length.toLocaleString('fr-FR')} morceaux, dans tous vos groupes.` : 'Chargement de la bibliothèque…'}
        </p>
      )}
      {results && results.length === 0 && <p className="muted pad">Aucun résultat pour « {query.trim()} ».</p>}
      {results && results.length > 0 && (
        <>
          <p className="muted small pad">
            {results.length.toLocaleString('fr-FR')} résultat{results.length > 1 ? 's' : ''}
          </p>
          <VirtualList
            items={results}
            rowHeight={ROW_HEIGHT}
            render={(t, i) => (
              <TrackRow
                key={t.key}
                track={t}
                active={t.key === currentKey}
                playing={playing}
                onPlay={() => playList(results, i, `Recherche « ${query.trim()} »`)}
              />
            )}
          />
        </>
      )}
    </div>
  )
}
