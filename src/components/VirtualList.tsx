import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

/**
 * Liste « virtuelle » : seules les lignes visibles sont réellement affichées,
 * ce qui garde l'appli fluide même avec des milliers de morceaux.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  render,
}: {
  items: T[]
  rowHeight: number
  render: (item: T, index: number) => ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState({ from: 0, to: 30 })

  const compute = () => {
    const el = ref.current
    const scroller = el?.closest('.scroll') as HTMLElement | null
    if (!el || !scroller) return
    const top = scroller.scrollTop - el.offsetTop
    const from = Math.max(0, Math.floor(top / rowHeight) - 8)
    const to = Math.min(items.length, Math.ceil((top + scroller.clientHeight) / rowHeight) + 8)
    setRange((r) => (r.from === from && r.to === to ? r : { from, to }))
  }

  useLayoutEffect(compute, [items.length, rowHeight])
  useEffect(() => {
    const scroller = ref.current?.closest('.scroll')
    if (!scroller) return
    scroller.addEventListener('scroll', compute, { passive: true })
    window.addEventListener('resize', compute)
    return () => {
      scroller.removeEventListener('scroll', compute)
      window.removeEventListener('resize', compute)
    }
  })

  return (
    <div ref={ref} style={{ height: items.length * rowHeight, position: 'relative' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: range.from * rowHeight }}>
        {items.slice(range.from, range.to).map((item, i) => render(item, range.from + i))}
      </div>
    </div>
  )
}
