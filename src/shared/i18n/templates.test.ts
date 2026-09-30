import { describe, expect, it } from 'vitest'
import { ar } from './ar'
import { en } from './en'

type Template = (...args: string[]) => string

/** Every message template in a bundle, by key path. */
function templates(v: unknown, path = ''): Array<[string, Template]> {
  if (typeof v === 'function') return [[path, v as Template]]
  if (!v || typeof v !== 'object') return []
  return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) =>
    templates(x, `${path}.${k}`)
  )
}

describe.each([
  ['ar', ar],
  ['en', en]
])('%s message templates', (_lang, bundle) => {
  it.each(templates(bundle))('%s puts every value it is given into the text', (_path, fn) => {
    const args = Array.from({ length: fn.length }, (_, i) => `Value${i + 1}`)
    const text = fn(...args)
    expect(text.trim()).not.toBe('')
    for (const a of args) expect(text.toLowerCase()).toContain(a.toLowerCase())
  })
})
