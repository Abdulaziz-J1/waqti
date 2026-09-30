import { AnimatePresence, motion } from 'motion/react'
import { Check, Info } from 'lucide-react'
import type { Flash } from '../lib/flash'
import { duration, ease } from '../motion'
import s from './FlashNote.module.css'

/** Where a flash appears: a live region, so screen readers read it too. */
export function FlashNote({
  flash,
  className
}: {
  flash: Flash | null
  className?: string
}): React.JSX.Element {
  return (
    <span className={`${s.slot} ${className ?? ''}`} role="status" aria-live="polite">
      <AnimatePresence mode="popLayout">
        {flash ? (
          <motion.span
            key={flash.key}
            className={s.note}
            data-tone={flash.tone}
            initial={{ opacity: 0, y: 6, scale: 0.96 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: { duration: duration.base, ease: ease.out }
            }}
            exit={{ opacity: 0, y: -4, transition: { duration: duration.fast } }}
            data-testid="flash-note"
          >
            <span className={s.icon} aria-hidden>
              {flash.tone === 'ok' ? <Check size={13} strokeWidth={3} /> : <Info size={14} />}
            </span>
            {flash.text}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  )
}
