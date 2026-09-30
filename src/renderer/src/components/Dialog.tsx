import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { common } from '@shared/strings'
import { duration, ease, spring } from '../motion'
import s from './Dialog.module.css'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md'
}

/** Modal dialog: focus moves in and is trapped, Esc and the scrim close it. */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md'
}: DialogProps): React.JSX.Element {
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  const returnTo = useRef<HTMLElement | null>(null)
  // The latest onClose, so a parent re-render (a saved setting) does not
  // re-run the open effect and move the focus back to the first control.
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })

  useEffect(() => {
    if (!open) return
    returnTo.current = document.activeElement as HTMLElement | null
    const t = requestAnimationFrame(() => {
      const first = box.current?.querySelector<HTMLElement>(
        'input, button:not([data-close]), [tabindex]:not([tabindex="-1"])'
      )
      ;(first ?? box.current)?.focus()
    })
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close.current()
      } else if (e.key === 'Tab' && box.current) {
        const items = [
          ...box.current.querySelectorAll<HTMLElement>(
            'button, input, select, [tabindex]:not([tabindex="-1"])'
          )
        ].filter((el) => !el.hasAttribute('disabled'))
        if (!items.length) return
        const first = items[0]!
        const last = items[items.length - 1]!
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      cancelAnimationFrame(t)
      document.removeEventListener('keydown', onKey, true)
      returnTo.current?.focus?.()
    }
  }, [open])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className={s.scrim}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: duration.base } }}
          exit={{ opacity: 0, transition: { duration: duration.fast } }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          <motion.div
            ref={box}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${id}-title`}
            tabIndex={-1}
            className={`${s.box} ${s[size]}`}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: spring.gentle }}
            exit={{
              opacity: 0,
              y: 6,
              scale: 0.98,
              transition: { duration: duration.fast, ease: ease.inOut }
            }}
          >
            <header className={s.head}>
              <h2 id={`${id}-title`} className={s.title}>
                {title}
              </h2>
              <button
                type="button"
                data-close
                className={s.close}
                aria-label={common.close}
                onClick={onClose}
              >
                <X size={18} />
              </button>
            </header>
            <div className={s.body}>{children}</div>
            {footer ? <footer className={s.footer}>{footer}</footer> : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
