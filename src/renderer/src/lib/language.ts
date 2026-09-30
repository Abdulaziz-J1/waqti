import { type Lang, app, dirOf, lang, setLanguage } from '@shared/strings'

/**
 * Makes `next` the interface language: the strings, and the page's `lang`
 * and `dir` (Arabic right to left, English left to right). Callers run it
 * before React renders, so every component reads the new words.
 */
export function applyLanguage(next: Lang): void {
  if (next !== lang) setLanguage(next)
  const root = document.documentElement
  if (root.lang !== next) root.lang = next
  const dir = dirOf(next)
  if (root.dir !== dir) root.dir = dir
  if (document.title !== app.name) document.title = app.name
}

/** True while the interface reads right to left (Arabic). */
export function rtl(): boolean {
  return dirOf(lang) === 'rtl'
}
