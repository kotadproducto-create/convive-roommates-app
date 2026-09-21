import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { cleanPinInput, isValidPin } from '../lib/publicPoll'
import { hasPollPin, setPollPin } from '../lib/publicPollApi'
import { LockIcon } from './icons'

// Quien ya tiene PIN (o lo acaba de crear) se recuerda en memoria: así no se
// consulta la base en cada pantalla, solo al abrir la app.
const usersWithPin = new Set()

/**
 * Pop-up que pide crear el PIN de 6 dígitos a quien todavía no lo tiene (las
 * cuentas anteriores a "votar por link"). No se puede cerrar sin guardarlo. Se
 * espera a que termine el tutorial guiado para no pisarse con él. Más tarde el
 * PIN se cambia desde Configuración, con la contraseña de Convive.
 */
export default function PinRequiredDialog() {
  const { user, membership } = useAuth()
  const { showToast } = useToast()
  const { t } = useLanguage()
  const userId = user?.id
  const eligible = Boolean(userId && membership && !user.tutorialEnabled)
  const [missing, setMissing] = useState(false)
  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!eligible || usersWithPin.has(userId)) {
      setMissing(false)
      return undefined
    }
    let active = true
    hasPollPin()
      .then((has) => {
        if (!active) return
        if (has) usersWithPin.add(userId)
        setMissing(!has)
      })
      .catch((err) => console.error('has_poll_pin', err))
    return () => {
      active = false
    }
  }, [eligible, userId])

  if (!missing) return null

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!isValidPin(pin)) {
      setError(t('ajustes.pin.errFormat'))
      return
    }
    if (pin !== confirmPin) {
      setError(t('ajustes.pin.errMismatch'))
      return
    }
    setSaving(true)
    try {
      const result = await setPollPin(pin)
      // 'pin_exists': ya lo había creado desde otro dispositivo; no hay nada más que pedir.
      if (!result?.ok && result?.error !== 'pin_exists') throw new Error(result?.error || 'set_poll_pin')
      usersWithPin.add(userId)
      if (result.ok) showToast(t('ajustes.pin.savedToast'), 'success')
      setMissing(false)
      setPin('')
      setConfirmPin('')
    } catch (err) {
      console.error('set_poll_pin', err)
      setError(t('ajustes.pin.errGeneric'))
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 bg-ink-900/50 backdrop-blur-sm flex items-end sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-labelledby="pin-required-title">
      <form
        onSubmit={handleSubmit}
        className="w-full sm:max-w-sm sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-4 sm:hidden" />
        <div className="flex items-center gap-2 mb-2">
          <LockIcon className="w-5 h-5 shrink-0 text-violet-500" />
          <h3 id="pin-required-title" className="font-display text-lg font-bold min-w-0">
            {t('ajustes.pin.requiredTitle')}
          </h3>
        </div>
        <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-2">{t('ajustes.pin.requiredBody')}</p>
        <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mb-4">{t('ajustes.pin.requiredNote')}</p>
        <div className="flex flex-col gap-3">
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            autoFocus
            className="input"
            placeholder={t('ajustes.pin.placeholder')}
            value={pin}
            onChange={(e) => setPin(cleanPinInput(e.target.value))}
            required
          />
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            className="input"
            placeholder={t('ajustes.pin.confirmPlaceholder')}
            value={confirmPin}
            onChange={(e) => setConfirmPin(cleanPinInput(e.target.value))}
            required
          />
          {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={saving}>
            {saving ? t('ajustes.pin.saving') : t('ajustes.pin.save')}
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}
