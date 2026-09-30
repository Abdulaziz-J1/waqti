import { describe, expect, it } from 'vitest'
import { defaultSettings } from '../settings/schema'
import { type Distractions, addChip, chipsOf, removeChip, setChip } from './distractions'

const base = (patch: Partial<Distractions> = {}): Distractions => ({
  ...defaultSettings().distractions,
  ...patch
})
const apply = (d: Distractions, p: Partial<Distractions>): Distractions => ({ ...d, ...p })

describe('distraction chips', () => {
  it('keeps a switched-off chip on the list', () => {
    let d = base()
    d = apply(d, addChip(d, 'apps', 'steam.exe'))
    expect(d.apps).toEqual(['steam.exe'])
    d = apply(d, setChip(d, 'apps', 'steam.exe', false))
    expect(d.apps).toEqual([])
    expect(chipsOf(d, 'apps')).toEqual(['steam.exe'])
    d = apply(d, setChip(d, 'apps', 'steam.exe', true))
    expect(d.apps).toEqual(['steam.exe'])
  })

  it('shows lists saved before chips could be switched off, in order', () => {
    const d = base({ keywords: ['مباراة', 'هدف'], listedKeywords: ['ملخص'] })
    expect(chipsOf(d, 'keywords')).toEqual(['ملخص', 'مباراة', 'هدف'])
    const off = apply(d, setChip(d, 'keywords', 'مباراة', false))
    expect(off.keywords).toEqual(['هدف'])
    expect(chipsOf(off, 'keywords')).toEqual(['ملخص', 'مباراة', 'هدف'])
  })

  it('leaves the preset sites out of the list: they are always shown', () => {
    let d = base()
    d = apply(d, setChip(d, 'sites', 'youtube', false))
    expect(d.sites).not.toContain('youtube')
    expect(d.listedSites).toEqual([])
    d = apply(d, addChip(d, 'sites', 'reddit'))
    expect(chipsOf(d, 'sites')).toEqual(['reddit'])
    expect(d.sites).toContain('reddit')
  })

  it('treats custom sites and keywords case-insensitively', () => {
    let d = base()
    d = apply(d, addChip(d, 'customSites', 'Kick'))
    d = apply(d, setChip(d, 'customSites', 'Kick', false))
    d = apply(d, addChip(d, 'customSites', 'kick'))
    expect(d.customSites).toEqual(['Kick'])
    expect(chipsOf(d, 'customSites')).toEqual(['Kick'])
  })

  it('removes a chip entirely', () => {
    let d = base({ apps: ['a.exe'], listedApps: ['a.exe', 'b.exe'] })
    d = apply(d, removeChip(d, 'apps', 'a.exe'))
    expect(d.apps).toEqual([])
    expect(chipsOf(d, 'apps')).toEqual(['b.exe'])
    d = apply(d, removeChip(d, 'apps', 'b.exe'))
    expect(chipsOf(d, 'apps')).toEqual([])
  })
})
