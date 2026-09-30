import { useId } from 'react'
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

/**
 * The Waqti mark: the day's arc with the sun on it. The same drawing as
 * build/icon.svg, which makes the app, taskbar and tray icons.
 */
export function LogoMark({
  size = 30,
  className
}: {
  size?: number
  className?: string
}): React.JSX.Element {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-tile`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#36428C" />
          <stop offset="1" stopColor="#1D2459" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="21" cy="14.5" r="8.5" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFE6A8" stopOpacity="0.5" />
          <stop offset="1" stopColor="#FFE6A8" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect x="1" y="1" width="30" height="30" rx="8" fill={`url(#${id}-tile)`} />
      <circle cx="21" cy="14.5" r="8.5" fill={`url(#${id}-glow)`} />
      <path
        d="M6 23 A10 10 0 0 1 26 23"
        fill="none"
        stroke="#EAF2F8"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <circle cx="21" cy="14.5" r="4.2" fill="#F5D08A" />
    </svg>
  )
}
