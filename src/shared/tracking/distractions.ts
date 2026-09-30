import type { Settings } from '../settings/schema'
import { PRESET_DISTRACTION_SITES } from './detect'

export type Distractions = Settings['distractions']
export type ChipKind = 'apps' | 'sites' | 'customSites' | 'keywords'

const LISTED = {
  apps: 'listedApps',
  sites: 'listedSites',
  customSites: 'listedCustomSites',
  keywords: 'listedKeywords'
} as const

const presets: readonly string[] = PRESET_DISTRACTION_SITES
/** Custom sites and keywords are words from page titles: "Kick" and "kick" are one chip. */
const caseless = (kind: ChipKind): boolean => kind === 'customSites' || kind === 'keywords'

/**
 * The chips of a kind beyond the preset sites, in the order they were added:
 * the listed ones (on or off) and any that are on without being listed
 * (lists saved before chips could be switched off).
 */
export function chipsOf(d: Distractions, kind: ChipKind): string[] {
  const out = [...d[LISTED[kind]]]
  for (const v of d[kind]) if (!out.includes(v)) out.push(v)
  return kind === 'sites' ? out.filter((v) => !presets.includes(v)) : out
}

function same(kind: ChipKind, a: string, b: string): boolean {
  return caseless(kind) ? a.toLowerCase() === b.toLowerCase() : a === b
}

/** Switches a chip on or off; it stays on the list either way. */
export function setChip(
  d: Distractions,
  kind: ChipKind,
  value: string,
  on: boolean
): Partial<Distractions> {
  const chips = chipsOf(d, kind)
  const existing = chips.find((v) => same(kind, v, value)) ?? value
  const listed =
    kind === 'sites' && presets.includes(existing)
      ? chips
      : chips.includes(existing)
        ? chips
        : [...chips, existing]
  const enabled = d[kind].filter((v) => v !== existing)
  return { [kind]: on ? [...enabled, existing] : enabled, [LISTED[kind]]: listed }
}

/** Adds a chip switched on (or switches on the one already there). */
export function addChip(d: Distractions, kind: ChipKind, value: string): Partial<Distractions> {
  return setChip(d, kind, value, true)
}

/** Takes a chip off the list entirely. Preset sites cannot be removed, only switched off. */
export function removeChip(d: Distractions, kind: ChipKind, value: string): Partial<Distractions> {
  return {
    [kind]: d[kind].filter((v) => v !== value),
    [LISTED[kind]]: chipsOf(d, kind).filter((v) => v !== value)
  }
}
