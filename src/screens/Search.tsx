import { useEffect, useMemo, useState } from 'react'
import { ROW_HEIGHT, TrackRow } from '../components/TrackRow'
import { VirtualList } from '../components/VirtualList'
import { useTracksByKeys } from '../lib/library'
import { ensureSearchIndex, searchKeys, useSearchIndex } from '../lib/searchIndex'
import { playList, usePlayer } from '../player/player'

const MAX_RESULTS = 300

/** Recherche par titre et artiste dans tous les groupes choisis. */
export function Search() {
  const index = useSearchIndex()
  const currentKey = usePlayer((s) => s.current?.key)
  const playing = usePlayer((s) => s.playing)
  const [text, setText] = useState('')
  const [query, setQuery] = useState('')

  useEffect(ensureSearchIndex, [index.status])

  // On attend une courte pause dans la frappe avant de chercher.
  useEffect(() => {
    const t = setTimeout(() => setQuery(text), 200)
    return () => clearTimeout(t)
  }, [text])

  const found = useMemo(
    () => searchKeys(query, MAX_RESULTS),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, index.version, index.status],
  )
  const results = useTracksByKeys(found?.keys ?? null)
  const building = index.status !== 'ready'

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
      {building && (
        <p className="muted small pad">
          <span className="spinner small" /> Préparation de la recherche… {Math.round(index.progress * 100)} % (
          {index.count.toLocaleString('fr-FR')} morceaux)
        </p>
      )}
      {!found && !building && (
        <p className="muted pad">Cherchez parmi {index.count.toLocaleString('fr-FR')} morceaux, dans tous vos groupes.</p>
      )}
      {found && found.total === 0 && !building && <p className="muted pad">Aucun résultat pour « {query.trim()} ».</p>}
      {found && found.total > 0 && (
        <>
          <p className="muted small pad">
            {found.total > MAX_RESULTS
              ? `${found.total.toLocaleString('fr-FR')} résultats — les ${MAX_RESULTS} plus récents sont affichés. Précisez la recherche pour affiner.`
              : `${found.total} résultat${found.total > 1 ? 's' : ''}`}
          </p>
          {results && (
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
          )}
        </>
      )}
    </div>
  )
}
