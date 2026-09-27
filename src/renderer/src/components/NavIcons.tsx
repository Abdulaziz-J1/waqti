import type { Page } from '@shared/ipc'

const common = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true
}

/** Sidebar icons drawn for Waqti: light, arcs and time — no cliché symbols. */
export function NavIcon({ page }: { page: Page }): React.JSX.Element {
  switch (page) {
    case 'today':
      return (
        <svg {...common}>
          <path d="M3 18h18" />
          <path d="M7 18a5 5 0 0 1 10 0" />
          <path d="M12 6.5v2M6.2 9.6l1.4 1.4M17.8 9.6l-1.4 1.4" />
        </svg>
      )
    case 'focus':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="1" fill="currentColor" />
        </svg>
      )
    case 'reports':
      return (
        <svg {...common}>
          <path d="M5 20v-8M10 20V5M15 20v-6M20 20v-10" />
        </svg>
      )
    case 'prayer':
      return (
        <svg {...common}>
          <path d="M3.5 18a8.5 8.5 0 0 1 17 0" />
          <circle cx="4.6" cy="13.8" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="8" cy="10.3" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="12" cy="9.5" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="16" cy="10.3" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="19.4" cy="13.8" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
          <circle cx="15" cy="7" r="2" />
          <circle cx="9" cy="17" r="2" />
        </svg>
      )
  }
}

/** The Waqti mark: the day's arc with the sun on it. */
export function LogoMark({ size = 30 }: { size?: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <defs>
        <linearGradient id="logo-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3E4A89" />
          <stop offset="1" stopColor="#101A33" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#logo-sky)" />
      <path
        d="M6 22a10 10 0 0 1 20 0"
        fill="none"
        stroke="#EAF2F8"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity=".85"
      />
      <path d="M5 22.5h22" stroke="#EAF2F8" strokeWidth="1.4" strokeLinecap="round" opacity=".35" />
      <circle cx="21.2" cy="14.4" r="3" fill="#D9B26F" />
    </svg>
  )
}
