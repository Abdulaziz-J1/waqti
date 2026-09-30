import { describe, expect, it } from 'vitest'
import { PlaybackStatus, anyPlaying, releasesAfterPause, shouldPause, statusName } from './media'

describe('media pause decisions', () => {
  it('pauses only sessions that are playing, so nothing ever starts', () => {
    expect(shouldPause({ appId: 'chrome', status: PlaybackStatus.playing })).toBe(true)
    for (const status of [
      PlaybackStatus.paused,
      PlaybackStatus.stopped,
      PlaybackStatus.changing,
      PlaybackStatus.opened,
      PlaybackStatus.closed
    ]) {
      expect(shouldPause({ appId: 'chrome', status })).toBe(false)
    }
  })

  it('can be limited to one app (the E2E test pauses only its own player)', () => {
    const own = { appId: 'com.waqti.desktop.dev', status: PlaybackStatus.playing }
    const user = { appId: 'Spotify.exe', status: PlaybackStatus.playing }
    expect(shouldPause(own, 'com.waqti.desktop.dev')).toBe(true)
    expect(shouldPause(user, 'com.waqti.desktop.dev')).toBe(false)
  })

  it('tells whether anything in scope is playing', () => {
    const paused = { appId: 'Brave', status: PlaybackStatus.paused }
    const playing = { appId: 'Spotify.exe', status: PlaybackStatus.playing }
    expect(anyPlaying([])).toBe(false)
    expect(anyPlaying([paused])).toBe(false)
    expect(anyPlaying([paused, playing])).toBe(true)
    expect(anyPlaying([paused, playing], 'Brave')).toBe(false)
  })

  it('releases only browser sessions after pausing them, to reach their other tabs', () => {
    for (const id of [
      'chrome',
      'Chrome.XYZ',
      'MSEdge',
      'Brave.CQAAXPIKYRTW4WFHDWFZVD6IVU',
      'Opera'
    ]) {
      expect(releasesAfterPause(id)).toBe(true)
    }
    for (const id of ['Spotify.exe', 'Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic', '']) {
      expect(releasesAfterPause(id)).toBe(false)
    }
    expect(releasesAfterPause('com.waqti.desktop.dev', 'com.waqti.desktop.dev')).toBe(true)
  })

  it('names statuses for the log', () => {
    expect(statusName(4)).toBe('playing')
    expect(statusName(5)).toBe('paused')
    expect(statusName(9)).toBe('unknown(9)')
  })
})
