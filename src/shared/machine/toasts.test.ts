import { describe, expect, it } from 'vitest'
import { prayerLabel, renderToast } from './toasts'
import type { PrayerRef } from './types'
import { MINUTE } from '../time'

const ASR: PrayerRef = { prayer: 'asr', day: '2026-09-27', at: 0, adhanAt: 0, isJumuah: false }
const JUMUAH: PrayerRef = {
  prayer: 'dhuhr',
  day: '2026-10-02',
  at: 0,
  adhanAt: 0,
  isJumuah: true
}

describe('toasts', () => {
  it('labels Friday Dhuhr as الجمعة', () => {
    expect(prayerLabel(JUMUAH)).toBe('الجمعة')
    expect(prayerLabel(ASR)).toBe('العصر')
  })

  it('renders every toast kind', () => {
    expect(renderToast({ kind: 'meeting', ref: ASR }, 'arab').body).toBe(
      'أنت في اجتماع الآن، بنذكّرك بعد ما تخلص'
    )
    expect(renderToast({ kind: 'meetingFinal', ref: ASR }, 'arab').body).toContain('العصر')
    expect(
      renderToast({ kind: 'resumeReminder', ref: ASR, agoMs: 7 * MINUTE }, 'arab').body
    ).toContain('٧ دقائق')
    const offer = renderToast({ kind: 'offer', ref: ASR, agoMs: 2 * MINUTE }, 'arab')
    expect(offer.action).toBe('acceptOffer')
    expect(offer.body).toContain('دقيقتين')
    expect(renderToast({ kind: 'focusResumed', remainingMs: 12 * MINUTE }, 'arab').body).toContain(
      '١٢ دقيقة'
    )
    expect(renderToast({ kind: 'focusDone', focusedMs: 25 * MINUTE }, 'arab').action).toBe(
      'openFocus'
    )
  })
})
