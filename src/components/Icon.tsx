const paths: Record<string, string> = {
  home: 'M4 11.5 12 4l8 7.5M6.5 10v9.5h11V10',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4.5 4.5',
  heart: 'M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20Z',
  groups: 'M4 6.5h16M4 12h16M4 17.5h10',
  settings: 'M5 7h6m4 0h4M5 17h3m4 0h7M13 5v4M10 15v4',
  back: 'M14.5 5 8 12l6.5 7',
  next: 'M6 5.5v13l9.5-6.5L6 5.5Zm12 0v13',
  check: 'm5 12.5 4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6 6 18',
  chevron: 'm9.5 5 6.5 7-6.5 7',
  down: 'm5 9.5 7 6.5 7-6.5',
  more: 'M5.5 12h.01M12 12h.01M18.5 12h.01',
  queue: 'M4 6.5h16M4 12h10M4 17.5h7M17 12.5v6.5l4.5-3.25L17 12.5Z',
  shuffle: 'M3 7h3.5c5 0 6 10 11 10H21m-2.5-2.5L21 17l-2.5 2.5M3 17h3.5c1.6 0 2.8-1 3.9-2.4M21 7h-3.5c-1.6 0-2.8 1-3.9 2.400M18.5 4.5 21 7l-2.5 2.5',
  repeat: 'M17 3.5 20 6.500l-3 3M4 11.500v-1a4 4 0 0 1 4-4h12M7 20.500l-3-3 3-3M20 12.500v1a4 4 0 0 1-4 4H4',
  playnext: 'M4 6.500h11M4 12h7M4 17.500h7M15 11v8l6-4-6-4Z',
  plus: 'M12 5v14M5 12h14',
  music: 'M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10-2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
}

export function Icon({ name, size = 24 }: { name: string; size?: number }) {
  if (name === 'play' || name === 'pause') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        {name === 'play' ? <path d="M7 4.500v15a1 1 0 0 0 1.5.86l12.5-7.500a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.500Z" /> : <path d="M6 4h4.500v16H6zM13.5 4H18v16h-4.500z" />}
      </svg>
    )
  }
  if (name === 'skip-next' || name === 'skip-prev') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden style={name === 'skip-prev' ? { transform: 'scaleX(-1)' } : undefined}>
        <path d="M5 5.300v13.400a.8.8 0 0 0 1.25.66L15.5 13v5.500a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-13a1 1 0 0 0-1-1h-1a1 1 0 0 0-1 1V11L6.25 4.64A.8.8 0 0 0 5 5.300Z" />
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name]} />
    </svg>
  )
}
