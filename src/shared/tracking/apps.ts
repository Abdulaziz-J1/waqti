/** Friendly names for common Windows apps, keyed by lowercase executable name. */
export const KNOWN_APPS: Readonly<Record<string, string>> = {
  'code.exe': 'Visual Studio Code',
  'devenv.exe': 'Visual Studio',
  'winword.exe': 'Microsoft Word',
  'excel.exe': 'Microsoft Excel',
  'powerpnt.exe': 'PowerPoint',
  'onenote.exe': 'OneNote',
  'outlook.exe': 'Outlook',
  'olk.exe': 'Outlook',
  'notion.exe': 'Notion',
  'obsidian.exe': 'Obsidian',
  'ms-teams.exe': 'Microsoft Teams',
  'teams.exe': 'Microsoft Teams',
  'zoom.exe': 'Zoom',
  'slack.exe': 'Slack',
  'figma.exe': 'Figma',
  'acrobat.exe': 'Adobe Acrobat',
  'acrord32.exe': 'Adobe Acrobat Reader',
  'windowsterminal.exe': 'Windows Terminal',
  'idea64.exe': 'IntelliJ IDEA',
  'pycharm64.exe': 'PyCharm',
  'rstudio.exe': 'RStudio',
  'matlab.exe': 'MATLAB',
  'chrome.exe': 'Google Chrome',
  'msedge.exe': 'Microsoft Edge',
  'firefox.exe': 'Firefox',
  'brave.exe': 'Brave',
  'opera.exe': 'Opera',
  'opera_gx.exe': 'Opera GX',
  'whatsapp.exe': 'WhatsApp',
  'whatsapp.root.exe': 'WhatsApp',
  'telegram.exe': 'Telegram',
  'discord.exe': 'Discord',
  'signal.exe': 'Signal',
  'steam.exe': 'Steam',
  'steamwebhelper.exe': 'Steam',
  'epicgameslauncher.exe': 'Epic Games',
  'spotify.exe': 'Spotify',
  'vlc.exe': 'VLC',
  'explorer.exe': 'File Explorer',
  'notepad.exe': 'Notepad',
  'waqti.exe': 'وقتي'
}

/** Descriptions that name a host process rather than the app the user sees. */
const GENERIC_DESCRIPTIONS = new Set(['application frame host', 'windows explorer', ''])

/** Lowercase executable file name from a path or name. */
export function processNameOf(exePathOrName: string): string {
  const base = exePathOrName.split(/[\\/]/).pop() ?? exePathOrName
  return base.toLowerCase()
}

/**
 * The name shown for an app: the executable's file description when it is
 * meaningful, then the known-app table, then the executable name.
 */
export function friendlyAppName(processName: string, description?: string | null): string {
  const lower = processName.toLowerCase()
  const desc = description?.trim() ?? ''
  if (desc && !GENERIC_DESCRIPTIONS.has(desc.toLowerCase()) && desc.length <= 60) return desc
  const known = KNOWN_APPS[lower]
  if (known) return known
  const bare = processName.replace(/\.exe$/i, '')
  return bare.charAt(0).toUpperCase() + bare.slice(1)
}

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

/** What the tracker knows about the foreground window at one moment. */
export interface ForegroundInfo {
  /** Stable app key: lowercase exe name, or `uwp:<title>` for Store apps. */
  process: string
  exePath: string
  appName: string
  title: string
  pid: number
  hwnd: number | null
  bounds: Bounds | null
  className?: string | null
}

export interface RawForeground {
  exePath: string
  title: string
  pid: number
  hwnd: number | null
  bounds: Bounds | null
  description?: string | null
  className?: string | null
}

/**
 * Normalises a raw foreground reading. Store (UWP) apps all run inside
 * ApplicationFrameHost.exe, so they are identified by their window title.
 */
export function normalizeForeground(raw: RawForeground): ForegroundInfo {
  const proc = processNameOf(raw.exePath)
  const title = raw.title ?? ''
  if (proc === 'applicationframehost.exe' && title.trim()) {
    const name = title.trim().slice(0, 40)
    return {
      process: `uwp:${name.toLowerCase()}`,
      exePath: raw.exePath,
      appName: name,
      title,
      pid: raw.pid,
      hwnd: raw.hwnd,
      bounds: raw.bounds,
      className: raw.className ?? null
    }
  }
  return {
    process: proc,
    exePath: raw.exePath,
    appName: friendlyAppName(proc, raw.description),
    title,
    pid: raw.pid,
    hwnd: raw.hwnd,
    bounds: raw.bounds,
    className: raw.className ?? null
  }
}
