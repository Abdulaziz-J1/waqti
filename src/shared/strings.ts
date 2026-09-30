/**
 * The interface strings of the active language (Arabic by default). Every
 * section is a live binding: `setLanguage` swaps them all, and code reads
 * them when it renders (the renderer remounts on a language change), so
 * `import { nav } from '@shared/strings'` always gives the current words.
 * The bundles are in `i18n/ar.ts` (the reference shape) and `i18n/en.ts`.
 */
import { LANGUAGE_NAMES, type Strings, ar } from './i18n/ar'
import { en } from './i18n/en'

export type Lang = 'ar' | 'en'
export type { Strings }
export { LANGUAGE_NAMES }
export const LANGS: readonly Lang[] = ['ar', 'en']

export function bundleOf(l: Lang): Strings {
  return l === 'en' ? en : ar
}

/** Arabic reads right to left, English left to right. */
export function dirOf(l: Lang): 'rtl' | 'ltr' {
  return l === 'ar' ? 'rtl' : 'ltr'
}

export let lang: Lang = 'ar'
export let units = ar.units
export let prayerNames = ar.prayerNames
export let periodNames = ar.periodNames
export let toasts = ar.toasts
export let tray = ar.tray
export let lock = ar.lock
export let adhan = ar.adhan
export let guard = ar.guard
export let app = ar.app
export let compare = ar.compare
export let csvHeaders = ar.csvHeaders
export let dialogs = ar.dialogs
export let nav = ar.nav
export let common = ar.common
export let trackingStatus = ar.trackingStatus
export let errorScreen = ar.errorScreen
export let notices = ar.notices
export let categoryNames = ar.categoryNames
export let greetings = ar.greetings
export let today = ar.today
export let focusPage = ar.focusPage
export let reports = ar.reports
export let prayerPage = ar.prayerPage
export let settingsPage = ar.settingsPage
export let onboarding = ar.onboarding
export let debug = ar.debug

/** Switches every section above to `next`. */
export function setLanguage(next: Lang): void {
  const b = bundleOf(next)
  lang = next
  units = b.units
  prayerNames = b.prayerNames
  periodNames = b.periodNames
  toasts = b.toasts
  tray = b.tray
  lock = b.lock
  adhan = b.adhan
  guard = b.guard
  app = b.app
  compare = b.compare
  csvHeaders = b.csvHeaders
  dialogs = b.dialogs
  nav = b.nav
  common = b.common
  trackingStatus = b.trackingStatus
  errorScreen = b.errorScreen
  notices = b.notices
  categoryNames = b.categoryNames
  greetings = b.greetings
  today = b.today
  focusPage = b.focusPage
  reports = b.reports
  prayerPage = b.prayerPage
  settingsPage = b.settingsPage
  onboarding = b.onboarding
  debug = b.debug
}
