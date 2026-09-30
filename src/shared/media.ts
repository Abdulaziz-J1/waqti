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

/** AppUserModelIDs of Chromium browsers (a profile may add a suffix, e.g. "Brave.ABC…"). */
const CHROMIUM_BROWSER = /^(chrome|msedge|brave|opera|vivaldi|yandex|arc)\b/i

/**
 * A Chromium browser shows Windows one media session for all its tabs, and a
 * tab keeps that session after it is paused. Stopping it (which in these
 * browsers pauses and keeps the position) hands the session to the next tab
 * that is still playing, so that one can be paused too. Other players may
 * reset to the start on stop, so they are only paused. `onlyAppId` is the
 * E2E test's own player, an Electron (Chromium) window.
 */
export function releasesAfterPause(appId: string, onlyAppId = ''): boolean {
  return CHROMIUM_BROWSER.test(appId) || (onlyAppId !== '' && appId === onlyAppId)
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
export type MediaRequest =
  | { kind: 'pause'; onlyAppId: string }
  | { kind: 'list' }
  /** Mutes the default output; the reply says whether it was muted before. */
  | { kind: 'mute' }
  | { kind: 'setMute'; muted: boolean }

export type MediaReply =
  | { kind: 'paused'; appIds: string[] }
  | { kind: 'sessions'; sessions: MediaSessionInfo[] }
  | { kind: 'muted'; wasMuted: boolean }
  | { kind: 'done' }
  | { kind: 'error'; message: string }
