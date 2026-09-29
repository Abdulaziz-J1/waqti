/**
 * Pausing media at the lock through Windows' Global System Media Transport
 * Controls (GSMTC), the sessions the volume flyout shows. The WinRT calls live
 * in src/main/media-helper.ts; this file holds the decisions, which are pure.
 */

/** GlobalSystemMediaTransportControlsSessionPlaybackStatus (Windows.Media.winmd). */
export const PlaybackStatus = {
  closed: 0,
  opened: 1,
  changing: 2,
  stopped: 3,
  playing: 4,
  paused: 5
} as const

export interface MediaSessionInfo {
  /** The app's AppUserModelID, e.g. "Spotify.exe" or "chrome". */
  appId: string
  status: number
}

/**
 * Only a session that is playing gets paused, so nothing ever starts playing
 * (no blind media keys). `onlyAppId` limits a test run to its own player.
 */
export function shouldPause(session: MediaSessionInfo, onlyAppId = ''): boolean {
  if (onlyAppId && session.appId !== onlyAppId) return false
  return session.status === PlaybackStatus.playing
}

/** Whether any session in scope is playing (someone may be watching or listening). */
export function anyPlaying(sessions: MediaSessionInfo[], onlyAppId = ''): boolean {
  return sessions.some((s) => shouldPause(s, onlyAppId))
}

/** Readable status for logs and the debug panel. */
export function statusName(status: number): string {
  const found = Object.entries(PlaybackStatus).find(([, v]) => v === status)
  return found ? found[0] : `unknown(${status})`
}

/** Messages between the main process and the media helper (a utility process). */
export type MediaRequest = { kind: 'pause'; onlyAppId: string } | { kind: 'list' }

export type MediaReply =
  | { kind: 'paused'; appIds: string[] }
  | { kind: 'sessions'; sessions: MediaSessionInfo[] }
  | { kind: 'error'; message: string }
