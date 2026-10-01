import { describe, expect, it } from 'vitest'
import { REPO_URL, feedbackUrl, windowsName } from './feedback'

describe('feedback', () => {
  it('names Windows 11 by its build, as it still reports 10.0', () => {
    expect(windowsName('10.0.26300')).toBe('Windows 11 (10.0.26300)')
    expect(windowsName('10.0.22000')).toBe('Windows 11 (10.0.22000)')
    expect(windowsName('10.0.19045')).toBe('Windows 10 (10.0.19045)')
    expect(windowsName('')).toBe('Windows')
  })

  it('opens the matching issue form with the version and Windows filled in', () => {
    const url = new URL(feedbackUrl('bug', { version: '1.0.0', osRelease: '10.0.26300' }))
    expect(`${url.origin}${url.pathname}`).toBe(`${REPO_URL}/issues/new`)
    expect(url.searchParams.get('template')).toBe('bug.yml')
    expect(url.searchParams.get('version')).toBe('1.0.0')
    expect(url.searchParams.get('windows')).toBe('Windows 11 (10.0.26300)')
    expect(
      new URL(feedbackUrl('idea', { version: '1.0.0', osRelease: '' })).searchParams.get('template')
    ).toBe('idea.yml')
  })
})
