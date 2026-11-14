import { useEffect, useState } from 'react'
import { cachedCoverUrl, coverUrl } from '../lib/covers'
import { hueOf, trackTitle } from '../lib/format'
import type { Track } from '../lib/types'
import { Icon } from './Icon'

/** Pochette d'un morceau, avec un dégradé coloré tant qu'il n'y a pas d'image. */
export function Cover({ track, size }: { track: Track; size: number }) {
  const [url, setUrl] = useState<string | null>(() => cachedCoverUrl(track) ?? null)

  useEffect(() => {
    const known = cachedCoverUrl(track)
    setUrl(known ?? null)
    if (known !== undefined) return
    let alive = true
    // Petit délai : on ne télécharge pas les pochettes des lignes qui défilent trop vite.
    const timer = setTimeout(() => coverUrl(track).then((u) => alive && setUrl(u)), 150)
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [track.key, track.thumbType])

  const hue = hueOf(trackTitle(track))
  return (
    <div
      className="cover"
      style={{
        width: size,
        height: size,
        borderRadius: Math.max(6, size * 0.16),
        background: `linear-gradient(140deg, hsl(${hue} 45% 34%), hsl(${(hue + 50) % 360} 40% 16%))`,
      }}
    >
      {url ? <img src={url} alt="" draggable={false} /> : <Icon name="music" size={size * 0.46} />}
    </div>
  )
}
