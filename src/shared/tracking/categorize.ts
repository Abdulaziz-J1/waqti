export type BuiltinCategoryId = 'work' | 'social' | 'fun' | 'other'

export interface Category {
  id: string
  name: string
  color: string
  builtin: boolean
}

export const BUILTIN_CATEGORIES: readonly Category[] = [
  { id: 'work', name: 'دراسة وعمل', color: '#3A78B5', builtin: true },
  { id: 'social', name: 'تواصل', color: '#2E9C87', builtin: true },
  { id: 'fun', name: 'ترفيه', color: '#D9793F', builtin: true },
  { id: 'other', name: 'أخرى', color: '#8791A5', builtin: true }
]

/** Colours offered for user-created categories. */
export const CUSTOM_CATEGORY_COLORS = [
  '#8E6CC4',
  '#C4577A',
  '#5E9E4A',
  '#B8912E',
  '#4B8FA6'
] as const

export const OTHER_CATEGORY = 'other'

export type RuleKind = 'app' | 'site' | 'path'

export interface Rule {
  kind: RuleKind
  /** app: lowercase process key; site: site id or label; path: lowercase substring of the exe path. */
  pattern: string
  categoryId: string
}

const app = (pattern: string, categoryId: BuiltinCategoryId): Rule => ({
  kind: 'app',
  pattern,
  categoryId
})
const site = (pattern: string, categoryId: BuiltinCategoryId): Rule => ({
  kind: 'site',
  pattern,
  categoryId
})
const path = (pattern: string, categoryId: BuiltinCategoryId): Rule => ({
  kind: 'path',
  pattern,
  categoryId
})

/** Shipped defaults. User rules always win over these. */
export const DEFAULT_RULES: readonly Rule[] = [
  // Study and work
  ...[
    'code.exe',
    'devenv.exe',
    'winword.exe',
    'excel.exe',
    'powerpnt.exe',
    'onenote.exe',
    'outlook.exe',
    'olk.exe',
    'notion.exe',
    'obsidian.exe',
    'ms-teams.exe',
    'teams.exe',
    'zoom.exe',
    'slack.exe',
    'figma.exe',
    'acrobat.exe',
    'acrord32.exe',
    'windowsterminal.exe',
    'idea64.exe',
    'pycharm64.exe',
    'rstudio.exe',
    'matlab.exe'
  ].map((p) => app(p, 'work')),
  ...[
    'google-docs',
    'google-sheets',
    'google-slides',
    'google-drive',
    'google-meet',
    'gmail',
    'outlook',
    'teams-web',
    'github',
    'stackoverflow',
    'chatgpt',
    'claude',
    'notion',
    'wikipedia',
    'coursera',
    'udemy',
    'blackboard'
  ].map((s) => site(s, 'work')),
  // Communication
  ...['whatsapp.exe', 'whatsapp.root.exe', 'telegram.exe', 'discord.exe', 'signal.exe'].map((p) =>
    app(p, 'social')
  ),
  ...['whatsapp', 'telegram', 'discord', 'x', 'instagram', 'snapchat', 'facebook', 'linkedin'].map(
    (s) => site(s, 'social')
  ),
  // Entertainment
  ...['youtube', 'netflix', 'tiktok', 'twitch', 'shahid', 'reddit'].map((s) => site(s, 'fun')),
  ...['steam.exe', 'steamwebhelper.exe', 'epicgameslauncher.exe', 'spotify.exe', 'vlc.exe'].map(
    (p) => app(p, 'fun')
  ),
  ...['uwp:netflix'].map((p) => app(p, 'fun')),
  ...[
    '\\steamapps\\common\\',
    '\\epic games\\',
    '\\riot games\\',
    '\\xboxgames\\',
    '\\minecraft',
    '\\roblox'
  ].map((p) => path(p, 'fun'))
]

export interface Activity {
  process: string
  exePath?: string | null
  site: string | null
}

const norm = (s: string): string => s.trim().toLowerCase()

function findRule(rules: readonly Rule[], kind: RuleKind, a: Activity): Rule | undefined {
  if (kind === 'site') {
    if (!a.site) return undefined
    const s = norm(a.site)
    return rules.find((r) => r.kind === 'site' && norm(r.pattern) === s)
  }
  if (kind === 'app') {
    const p = norm(a.process)
    return rules.find((r) => r.kind === 'app' && norm(r.pattern) === p)
  }
  const exe = norm(a.exePath ?? '')
  if (!exe) return undefined
  return rules.find((r) => r.kind === 'path' && exe.includes(norm(r.pattern)))
}

/**
 * Categorises an activity. Rules are applied at query time, so changing a rule
 * re-categorises all history. Sites are listed as their own activities, so a
 * site rule (user, then default) always beats an app rule for the browser.
 * Precedence: user site → default site → user app → user path → default path →
 * default app → "أخرى". A rule pointing at a deleted category gives "أخرى".
 */
export function categorize(
  a: Activity,
  userRules: readonly Rule[],
  knownCategoryIds: ReadonlySet<string>,
  defaults: readonly Rule[] = DEFAULT_RULES
): string {
  const order: Array<[readonly Rule[], RuleKind]> = [
    [userRules, 'site'],
    [defaults, 'site'],
    [userRules, 'app'],
    [userRules, 'path'],
    [defaults, 'path'],
    [defaults, 'app']
  ]
  for (const [rules, kind] of order) {
    const r = findRule(rules, kind, a)
    if (r) return knownCategoryIds.has(r.categoryId) ? r.categoryId : OTHER_CATEGORY
  }
  return OTHER_CATEGORY
}

/** Builds a memoised categoriser for a query (rules are fixed during one query). */
export function makeCategorizer(
  userRules: readonly Rule[],
  categories: readonly Category[]
): (a: Activity) => string {
  const ids = new Set(categories.map((c) => c.id))
  const cache = new Map<string, string>()
  return (a) => {
    const key = `${a.process}\u0000${a.site ?? ''}\u0000${a.exePath ?? ''}`
    let v = cache.get(key)
    if (v === undefined) {
      v = categorize(a, userRules, ids)
      cache.set(key, v)
    }
    return v
  }
}

export function allCategories(custom: readonly Category[]): Category[] {
  return [...BUILTIN_CATEGORIES, ...custom.filter((c) => !c.builtin)]
}
