/** Browsers whose window titles carry the active page. */
export const BROWSERS: Readonly<Record<string, string>> = {
  'chrome.exe': 'Google Chrome',
  'msedge.exe': 'Microsoft Edge',
  'firefox.exe': 'Firefox',
  'brave.exe': 'Brave',
  'opera.exe': 'Opera',
  'opera_gx.exe': 'Opera GX'
}

export function isBrowser(processName: string): boolean {
  return processName.toLowerCase() in BROWSERS
}

export interface SiteDef {
  id: string
  /** Display label (brand names stay in Latin script). */
  label: string
  match: RegExp[]
}

/**
 * Sites recognised from page titles. Order matters: the first match wins, so
 * specific products (Google Meet) come before generic ones (Google).
 */
export const KNOWN_SITES: readonly SiteDef[] = [
  { id: 'youtube', label: 'YouTube', match: [/\bYouTube\b/i, /يوتيوب/] },
  { id: 'tiktok', label: 'TikTok', match: [/\bTikTok\b/i, /تيك\s?توك/] },
  { id: 'netflix', label: 'Netflix', match: [/\bNetflix\b/i, /نتفليكس/] },
  { id: 'snapchat', label: 'Snapchat', match: [/\bSnapchat\b/i, /سناب\s?شات/] },
  {
    id: 'x',
    label: 'X',
    match: [/(^|\s)\/ X$/, /\bon X\b/, /\bTwitter\b/i, /^X$/, /\(@\w+\) \/ X/]
  },
  { id: 'instagram', label: 'Instagram', match: [/\bInstagram\b/i, /إنستغرام|انستقرام/] },
  { id: 'twitch', label: 'Twitch', match: [/\bTwitch\b/i] },
  { id: 'whatsapp', label: 'WhatsApp', match: [/\bWhatsApp\b/i, /واتساب/] },
  { id: 'telegram', label: 'Telegram', match: [/\bTelegram\b/i] },
  { id: 'discord', label: 'Discord', match: [/\bDiscord\b/i] },
  { id: 'facebook', label: 'Facebook', match: [/\bFacebook\b/i] },
  { id: 'reddit', label: 'Reddit', match: [/\breddit\b/i] },
  { id: 'linkedin', label: 'LinkedIn', match: [/\bLinkedIn\b/i] },
  { id: 'shahid', label: 'Shahid', match: [/\bShahid\b/i, /شاهد VIP/] },
  { id: 'google-meet', label: 'Google Meet', match: [/\bGoogle Meet\b/i, /^Meet [-–] /] },
  { id: 'gmail', label: 'Gmail', match: [/\bGmail\b/i] },
  { id: 'outlook', label: 'Outlook', match: [/\bOutlook\b/i] },
  { id: 'google-docs', label: 'Google Docs', match: [/Google Docs/i, /مستندات Google/] },
  { id: 'google-sheets', label: 'Google Sheets', match: [/Google Sheets/i, /جداول بيانات Google/] },
  {
    id: 'google-slides',
    label: 'Google Slides',
    match: [/Google Slides/i, /العروض التقديمية من Google/]
  },
  { id: 'google-drive', label: 'Google Drive', match: [/Google Drive/i] },
  { id: 'teams-web', label: 'Microsoft Teams', match: [/Microsoft Teams/i] },
  { id: 'github', label: 'GitHub', match: [/\bGitHub\b/i] },
  { id: 'stackoverflow', label: 'Stack Overflow', match: [/Stack Overflow/i] },
  { id: 'chatgpt', label: 'ChatGPT', match: [/\bChatGPT\b/i] },
  { id: 'claude', label: 'Claude', match: [/(^|[-|] )Claude$/] },
  { id: 'notion', label: 'Notion', match: [/\bNotion\b/] },
  { id: 'wikipedia', label: 'Wikipedia', match: [/Wikipedia/i, /ويكيبيديا/] },
  { id: 'coursera', label: 'Coursera', match: [/\bCoursera\b/i] },
  { id: 'udemy', label: 'Udemy', match: [/\bUdemy\b/i] },
  { id: 'blackboard', label: 'Blackboard', match: [/\bBlackboard\b/i] },
  { id: 'google', label: 'Google', match: [/ - Google Search$/, / - بحث Google$/] }
]

export function siteById(id: string): SiteDef | undefined {
  return KNOWN_SITES.find((s) => s.id === id)
}

/** Label for a stored site value (known id → brand label, otherwise as stored). */
export function siteLabel(site: string): string {
  return siteById(site)?.label ?? site
}

/** Edge writes "Microsoft" + zero-width space + "Edge" in window titles. */
const ZWSP = String.fromCharCode(0x200b)

const BROWSER_SUFFIXES: RegExp[] = [
  /\s[-—–]\sGoogle Chrome$/,
  // Matched after zero-width spaces are removed from the title.
  /\s[-—–]\sMicrosoft\s?Edge$/,
  /\s[-—–]\sMozilla Firefox( Private Browsing)?$/,
  /\s[-—–]\sBrave$/,
  /\s[-—–]\sOpera( GX)?$/
]

const EDGE_PROFILE = /^(Personal|Work|Profile \d+|شخصي|العمل|الملف الشخصي \d+)$/

/**
 * Strips the browser name (and Edge's profile segment) from a window title,
 * leaving the page title.
 */
export function pageTitle(processName: string, title: string): string {
  let t = title.split(ZWSP).join('').trim()
  for (const re of BROWSER_SUFFIXES) {
    if (re.test(t)) {
      t = t.replace(re, '')
      break
    }
  }
  if (processName.toLowerCase() === 'msedge.exe') {
    // "Page and 3 more pages - Personal" → drop the profile and tab-count tail.
    const parts = t.split(/\s[-—–]\s/)
    if (parts.length >= 2 && EDGE_PROFILE.test(parts.at(-1)!)) parts.pop()
    t = parts.join(' - ').replace(/ and \d+ more pages?$/, '')
  }
  return t.trim()
}

/**
 * Derives the site from a browser window title
 * ("Video - YouTube - Google Chrome" → "youtube"). Known sites return their id;
 * otherwise the trailing " - Brand" segment is used when it looks like a site
 * name. Returns null when nothing reliable can be derived.
 */
export function deriveSite(processName: string, title: string | null | undefined): string | null {
  if (!title || !isBrowser(processName)) return null
  const page = pageTitle(processName, title)
  if (!page) return null
  for (const site of KNOWN_SITES) {
    if (site.match.some((re) => re.test(page))) return site.id
  }
  const segments = page.split(/\s[-—–|·]\s/).map((s) => s.trim())
  if (segments.length < 2) return null
  const last = segments.at(-1)!
  const words = last.split(/\s+/).length
  if (last.length >= 2 && last.length <= 25 && words <= 3 && !/^[\d\s.,:]+$/.test(last)) {
    return last
  }
  return null
}
