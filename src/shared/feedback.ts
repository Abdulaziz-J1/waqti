/** Suggestions and problem reports go to the project's GitHub issues. */
export const REPO_URL = 'https://github.com/Abdulaziz-J1/waqti'

export type FeedbackKind = 'bug' | 'idea'

export interface FeedbackContext {
  version: string
  /** `os.release()`, like "10.0.26300". */
  osRelease: string
}

/** "Windows 11 (10.0.26300)": Windows 11 still reports 10.0, with builds from 22000. */
export function windowsName(release: string): string {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(release)
  if (!m) return 'Windows'
  return `${Number(m[3]) >= 22000 ? 'Windows 11' : 'Windows 10'} (${m[0]})`
}

/** A new issue on the matching form, with the version and Windows already filled in. */
export function feedbackUrl(kind: FeedbackKind, ctx: FeedbackContext): string {
  const q = new URLSearchParams({
    template: `${kind}.yml`,
    version: ctx.version,
    windows: windowsName(ctx.osRelease)
  })
  return `${REPO_URL}/issues/new?${q.toString()}`
}
