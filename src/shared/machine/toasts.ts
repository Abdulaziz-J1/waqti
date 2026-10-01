import { type Digits, fmtDuration } from '../format'
import { prayerNames, toasts } from '../strings'
import type { PrayerRef, ToastSpec } from './types'

export interface RenderedToast {
  title: string
  body: string
  /** What clicking the toast does. */
  action: 'open' | 'acceptOffer' | 'openFocus'
}

/** "العصر" or "الجمعة" for Friday Dhuhr. */
export function prayerLabel(ref: Pick<PrayerRef, 'prayer' | 'isJumuah'>): string {
  return ref.isJumuah ? prayerNames.jumuah : prayerNames[ref.prayer]
}

/** Turns a semantic toast from the state machine into Arabic text. */
export function renderToast(spec: ToastSpec, digits: Digits): RenderedToast {
  switch (spec.kind) {
    case 'meeting':
      return { title: toasts.meetingTitle, body: toasts.meetingBody, action: 'open' }
    case 'meetingFinal':
      return {
        title: toasts.appTitle,
        body: toasts.meetingFinalBody(prayerLabel(spec.ref)),
        action: 'open'
      }
    case 'resumeReminder': {
      const name = prayerLabel(spec.ref)
      return {
        title: toasts.resumeTitle(name),
        body: toasts.resumeBody(
          fmtDuration(spec.agoMs, digits, { round: 'round', gramCase: 'obl' }),
          name
        ),
        action: 'open'
      }
    }
    case 'offer':
      return {
        title: toasts.offerTitle(prayerLabel(spec.ref)),
        body: toasts.offerBody(
          fmtDuration(spec.agoMs, digits, { round: 'round', gramCase: 'obl' })
        ),
        action: 'acceptOffer'
      }
    case 'focusResumed':
      return {
        title: toasts.focusResumedTitle,
        body: toasts.focusResumedBody(fmtDuration(spec.remainingMs, digits, { round: 'ceil' })),
        action: 'openFocus'
      }
    case 'focusDone':
      return {
        title: toasts.focusDoneTitle,
        // Object of the verb ركّزت takes the oblique dual (ساعتين).
        body: toasts.focusDoneBody(fmtDuration(spec.focusedMs, digits, { gramCase: 'obl' })),
        action: 'openFocus'
      }
  }
}
