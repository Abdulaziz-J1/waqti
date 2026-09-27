import { z } from 'zod'
import type { MeetingConfig } from './detect'

/** Validates `meeting-apps.json` (main process only; keeps zod out of the renderer bundle). */
export const meetingConfigSchema: z.ZodType<MeetingConfig> = z.object({
  version: z.literal(1),
  apps: z.array(z.string().min(1)),
  browserTitles: z.array(z.string().min(1)),
  slideshow: z.object({
    apps: z.array(z.string().min(1)),
    windowClasses: z.array(z.string().min(1)),
    titles: z.array(z.string().min(1))
  })
})
