import { useState } from 'react'
import { ApiError } from '../lib/apiClient'
import { geocodeByQuery, reverseGeocode } from '../geo/geoApi'

export type AddressPickerValue = {
  addressText: string
  latitude: number | null
  longitude: number | null
}

type AddressPickerProps = {
  idPrefix: string
  accessToken: string | null
  disabled?: boolean
  value: AddressPickerValue
  onChange: (next: AddressPickerValue) => void
  label?: string
  hint?: string
}

function pickErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return 'Не удалось определить адрес'
}

export function AddressPicker({
  idPrefix,
  accessToken,
  disabled = false,
  value,
  onChange,
  label = 'Адрес',
  hint = 'Введите адрес и нажмите «Уточнить» — координаты подставятся с сервера (Яндекс). Либо используйте геолокацию.',
}: AddressPickerProps) {
  const [busy, setBusy] = useState<'geocode' | 'geo' | null>(null)
  const [msg, setMsg] = useState<{ type: 'err' | 'ok'; text: string } | null>(null)

  const inputId = `${idPrefix}-address`
  const busyDisabled = disabled || !accessToken || busy !== null

  const handleTextChange = (text: string) => {
    setMsg(null)
    onChange({ addressText: text, latitude: null, longitude: null })
  }

  const handleGeocode = async () => {
    const q = value.addressText.trim()
    if (q.length < 2) {
      setMsg({ type: 'err', text: 'Введите не менее 2 символов адреса' })
      return
    }
    if (!accessToken) return
    setBusy('geocode')
    setMsg(null)
    try {
      const res = await geocodeByQuery(q, accessToken)
      onChange({
        addressText: res.addressText,
        latitude: res.latitude,
        longitude: res.longitude,
      })
      setMsg({ type: 'ok', text: 'Адрес подтверждён' })
    } catch (err: unknown) {
      setMsg({ type: 'err', text: pickErrorMessage(err) })
    } finally {
      setBusy(null)
    }
  }

  const handleMyLocation = () => {
    if (!accessToken) return
    if (!navigator.geolocation) {
      setMsg({ type: 'err', text: 'Геолокация недоступна в этом браузере' })
      return
    }
    setBusy('geo')
    setMsg(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await reverseGeocode(pos.coords.latitude, pos.coords.longitude, accessToken)
          onChange({
            addressText: res.addressText,
            latitude: res.latitude,
            longitude: res.longitude,
          })
          setMsg({ type: 'ok', text: 'Адрес определён по геолокации' })
        } catch (err: unknown) {
          setMsg({ type: 'err', text: pickErrorMessage(err) })
        } finally {
          setBusy(null)
        }
      },
      () => {
        setBusy(null)
        setMsg({
          type: 'err',
          text: 'Не удалось получить координаты. Разрешите доступ к геолокации или введите адрес вручную.',
        })
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    )
  }

  const handleClear = () => {
    setMsg(null)
    onChange({ addressText: '', latitude: null, longitude: null })
  }

  const hasCoords = value.latitude != null && value.longitude != null

  return (
    <div className="field address-picker" style={{ marginBottom: 0 }}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <textarea
        id={inputId}
        className="field__input"
        rows={3}
        maxLength={500}
        placeholder="Город, улица, дом"
        value={value.addressText}
        onChange={(e) => handleTextChange(e.target.value)}
        disabled={disabled}
      />
      <span className="field__hint">{hint}</span>
      <div className="address-picker__actions" style={{ marginTop: 'var(--sp-3)' }}>
        <button
          type="button"
          className="btn btn--brand"
          disabled={busyDisabled}
          onClick={() => void handleGeocode()}
        >
          {busy === 'geocode' ? 'Поиск…' : 'Уточнить адрес'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={busyDisabled}
          onClick={() => handleMyLocation()}
        >
          {busy === 'geo' ? 'Геолокация…' : 'Где я сейчас'}
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          disabled={disabled || !accessToken || (!value.addressText.trim() && !hasCoords)}
          onClick={handleClear}
        >
          Сбросить
        </button>
      </div>
      {hasCoords ? (
        <p className="field__hint" style={{ marginTop: 'var(--sp-2)' }}>
          Координаты зафиксированы (поиск и карта на сайте используют их при наличии).
        </p>
      ) : value.addressText.trim() ? (
        <p className="field__hint" style={{ marginTop: 'var(--sp-2)' }}>
          Нажмите «Уточнить адрес» или «Где я сейчас», чтобы сохранить точку на карте.
        </p>
      ) : null}
      {msg ? (
        <p
          className={
            msg.type === 'ok'
              ? 'profile-resend-msg profile-resend-msg--ok'
              : 'profile-resend-msg profile-resend-msg--err'
          }
          style={{ marginTop: 'var(--sp-2)', marginBottom: 0 }}
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  )
}
