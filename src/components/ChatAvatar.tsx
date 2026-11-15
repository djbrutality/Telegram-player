import { useEffect, useRef, useState } from 'react'
import { cachedChatPhotoUrl, chatPhotoUrl } from '../lib/covers'
import { hueOf } from '../lib/format'
import type { ChatInfo } from '../lib/types'

/** Photo de profil d'un groupe (chargée quand la ligne devient visible), sinon son initiale. */
export function ChatAvatar({ chat }: { chat: ChatInfo }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [url, setUrl] = useState<string | null>(() => cachedChatPhotoUrl(chat) ?? null)

  useEffect(() => {
    const known = cachedChatPhotoUrl(chat)
    setUrl(known ?? null)
    if (known !== undefined || !ref.current) return
    let alive = true
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      observer.disconnect()
      chatPhotoUrl(chat).then((u) => alive && setUrl(u))
    })
    observer.observe(ref.current)
    return () => {
      alive = false
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id, chat.photoId])

  return (
    <span ref={ref} className="avatar" style={{ background: `hsl(${hueOf(chat.title)} 42% 32%)` }}>
      {url ? <img src={url} alt="" draggable={false} /> : ([...chat.title.trim()][0]?.toUpperCase() ?? '?')}
    </span>
  )
}
