import { useState } from 'react'
import { CITIES, cityName, cityRegion, isValidCoordinate } from '@shared/prayer/cities'
import type { LocationSetting } from '@shared/settings/schema'
import { prayerPage as t } from '@shared/strings'
import { Button } from './Button'
import { TextField } from './Field'
import { Select } from './Select'
import s from './LocationPicker.module.css'

const CUSTOM = '__custom'

interface LocationPickerProps {
  value: LocationSetting
  onChange: (loc: LocationSetting) => void
}

/** City dropdown (19 Saudi cities) with a custom-coordinates option. */
export function LocationPicker({ value, onChange }: LocationPickerProps): React.JSX.Element {
  const [mode, setMode] = useState<string>(value.kind === 'city' ? value.cityId : CUSTOM)
  const [lat, setLat] = useState(value.kind === 'custom' ? String(value.lat) : '')
  const [lng, setLng] = useState(value.kind === 'custom' ? String(value.lng) : '')
  const [error, setError] = useState<string | null>(null)

  const options = [
    ...CITIES.map((c) => ({ value: c.id, label: cityName(c), hint: cityRegion(c) })),
    { value: CUSTOM, label: t.customCoords }
  ]

  const applyCustom = (): void => {
    const la = Number(lat.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)))
    const ln = Number(lng.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660)))
    if (!lat.trim() || !lng.trim() || !isValidCoordinate(la, ln)) {
      setError(t.coordsInvalid)
      return
    }
    setError(null)
    onChange({ kind: 'custom', lat: la, lng: ln })
  }

  return (
    <div className={s.root}>
      <Select
        label={t.city}
        value={mode}
        options={options}
        onChange={(v) => {
          setMode(v)
          if (v !== CUSTOM) {
            setError(null)
            onChange({ kind: 'city', cityId: v })
          }
        }}
      />
      {mode === CUSTOM ? (
        <div className={s.custom}>
          <div className={s.coords}>
            <TextField
              label={t.lat}
              inputMode="decimal"
              placeholder="24.7136"
              value={lat}
              error={error}
              onChange={(e) => setLat(e.target.value)}
            />
            <TextField
              label={t.lng}
              inputMode="decimal"
              placeholder="46.6753"
              value={lng}
              error={error}
              onChange={(e) => setLng(e.target.value)}
            />
          </div>
          {error ? (
            <p className={s.error} role="alert">
              {error}
            </p>
          ) : null}
          <Button variant="secondary" onClick={applyCustom}>
            {t.applyCoords}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
