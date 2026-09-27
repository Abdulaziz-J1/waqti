import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, Info, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { common, notices } from '@shared/strings'
import { api } from '../lib/api'
import { useSnapshot } from '../lib/store'
import { spring } from '../motion'
import s from './Toaster.module.css'

/**
 * In-app messages: a one-time notice from main (database restored/reset) and
 * a plain Arabic message when any request to the main process fails, so an
 * error is never silent.
 */
export function Toaster(): React.JSX.Element {
  const snap = useSnapshot()
  const [error, setError] = useState(false)

  useEffect(() => {
    const onRejection = (e: PromiseRejectionEvent): void => {
      console.error('request failed', e.reason)
      setError(true)
    }
    window.addEventListener('unhandledrejection', onRejection)
    return () => window.removeEventListener('unhandledrejection', onRejection)
  }, [])

  useEffect(() => {
    if (!error) return
    const t = setTimeout(() => setError(false), 6000)
    return () => clearTimeout(t)
  }, [error])

  const notice = snap.notice
  return (
    <div className={s.stack} aria-live="polite">
      <AnimatePresence>
        {notice ? (
          <motion.div
            key="notice"
            className={s.toast}
            data-tone="info"
            role="status"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring.gentle}
          >
            <Info size={18} className={s.icon} />
            <p className={s.text}>{notices[notice]}</p>
            <button
              type="button"
              className={s.action}
              onClick={() => void api.invoke('app:dismissNotice')}
            >
              {notices.dismiss}
            </button>
          </motion.div>
        ) : null}
        {error ? (
          <motion.div
            key="error"
            className={s.toast}
            data-tone="error"
            role="alert"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={spring.gentle}
          >
            <AlertCircle size={18} className={s.icon} />
            <p className={s.text}>{common.saveError}</p>
            <button
              type="button"
              className={s.close}
              aria-label={common.close}
              onClick={() => setError(false)}
            >
              <X size={16} />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
