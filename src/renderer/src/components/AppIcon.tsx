import { siteById } from '@shared/tracking/sites'
import s from './AppIcon.module.css'

interface AppIconProps {
  icon: string | null
  name: string
  site?: string | null
  color?: string
  size?: number
}

/** App icon from Windows, or a lettered disc (sites and apps without an icon). */
export function AppIcon({ icon, name, site, color, size = 28 }: AppIconProps): React.JSX.Element {
  if (icon && !site) {
    return <img src={icon} alt="" width={size} height={size} className={s.img} draggable={false} />
  }
  const label = site ? (siteById(site)?.label ?? site) : name
  const letter = [...label.trim()][0]?.toUpperCase() ?? '•'
  return (
    <span
      className={s.disc}
      style={{ inlineSize: size, blockSize: size, fontSize: size * 0.46, background: color }}
      aria-hidden
    >
      {letter}
    </span>
  )
}
