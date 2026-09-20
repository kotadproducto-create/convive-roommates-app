import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../context/LanguageContext'
import { CloseIcon } from './icons'

/**
 * Tu piso → Roommates → "Código de recuperación" (solo admins): genera un
 * código de un solo uso para que un compañero recupere su acceso cuando no le
 * llega el correo de "Olvidé mi contraseña" (ver la función admin-recovery-code).
 * Paso 1: confirmar. Paso 2: el código, listo para copiar o mandar por WhatsApp.
 * Se dibuja en document.body para no quedar encerrado en la tarjeta.
 */
export default function RecoveryCodeDialog({ member, generate, onClose }) {
  const { t } = useLanguage()
  const [step, setStep] = useState('confirm') // 'confirm' | 'code'
  const [code, setCode] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setWorking(true)
    setError('')
    try {
      setCode(await generate(member.id))
      setStep('code')
    } catch (err) {
      const known = ['not_admin', 'not_member', 'too_soon', 'not_found']
      setError(t(`floorSettings.recovery.errors.${known.includes(err?.code) ? err.code : 'failed'}`))
    } finally {
      setWorking(false)
    }
  }

  const shareText = t('floorSettings.recovery.shareText', { code })

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = code
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 relative max-h-[90vh] overflow-y-auto"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-4 sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        {step === 'confirm' ? (
          <>
            <h3 className="font-display text-lg font-bold mb-2 pr-8">{t('floorSettings.recovery.title', { name: member.name })}</h3>
            <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-2">{t('floorSettings.recovery.confirmBody', { name: member.name })}</p>
            <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mb-4">{t('floorSettings.recovery.notifyNote', { name: member.name })}</p>
            {error && <p className="text-sm font-medium text-clay-500 mb-3">{error}</p>}
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm flex-1" onClick={onClose} disabled={working}>
                {t('floorSettings.cancel')}
              </button>
              <button type="button" className="btn-primary text-sm flex-1" onClick={handleGenerate} disabled={working}>
                {working ? t('floorSettings.recovery.generating') : t('floorSettings.recovery.generate')}
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="font-display text-lg font-bold mb-2 pr-8">{t('floorSettings.recovery.codeFor', { name: member.name })}</h3>
            <p className="text-center font-display text-4xl font-bold tracking-[0.3em] py-3 mb-2 rounded-xl bg-white dark:bg-ink-700 border-2 border-ink-900/20 dark:border-cream-100/20 break-all">
              {code}
            </p>
            <ol className="text-sm text-ink-900/70 dark:text-cream-100/70 list-decimal pl-5 flex flex-col gap-1 mb-4">
              <li>{t('floorSettings.recovery.step1', { name: member.name })}</li>
              <li>{t('floorSettings.recovery.step2')}</li>
              <li>{t('floorSettings.recovery.step3')}</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-secondary text-sm flex-1" onClick={handleCopy}>
                {copied ? t('floorSettings.recovery.copied') : t('floorSettings.recovery.copy')}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noreferrer noopener"
                className="btn-primary text-sm flex-1"
              >
                {t('floorSettings.recovery.whatsapp')}
              </a>
            </div>
            <p className="text-xs text-ink-900/50 dark:text-cream-100/50 mt-3">{t('floorSettings.recovery.expires')}</p>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
