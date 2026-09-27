import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../context/LanguageContext'
import { formatEuros } from '../lib/pot'
import { CloseIcon } from './icons'

/**
 * "Reportar incidencia" sobre un aporte/gasto del Pote que registró OTRO
 * compañero a tu nombre (ver disputePotContribution en DataContext.jsx) —
 * se abre desde el historial del Pote (Wallet.jsx) o desde la propia
 * notificación (NotificationItem.jsx), por eso vive en su propio archivo
 * en vez de duplicarse. Se dibuja en document.body (createPortal) para no
 * quedar encerrado en la tarjeta o el desplegable desde donde se abrió.
 */
export default function DisputeContributionDialog({ contribution, onConfirm, onCancel }) {
  const { t, language } = useLanguage()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const isExpense = Number(contribution.amount) < 0

  async function handleSubmit(e) {
    e.preventDefault()
    if (!reason.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await onConfirm(reason.trim())
    } catch (err) {
      setError(t('wallet.disputeErrorToast', { error: err.message }))
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
      onClick={onCancel}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 relative max-h-[90vh] overflow-y-auto"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-4 sm:hidden" />
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
        <h3 className="font-display text-lg font-bold mb-2 pr-8">{t('wallet.disputeDialogTitle')}</h3>
        <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-3">
          {t(isExpense ? 'wallet.disputeDialogSubjectExpense' : 'wallet.disputeDialogSubjectContribution', {
            amount: formatEuros(Math.abs(Number(contribution.amount)), language)
          })}
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <textarea
            className="input min-h-24"
            placeholder={t('wallet.disputeReasonPlaceholder')}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            autoFocus
          />
          {error && <p className="text-sm font-medium text-clay-500">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm flex-1" onClick={onCancel} disabled={submitting}>
              {t('wallet.cancel')}
            </button>
            <button type="submit" className="btn-danger text-sm flex-1" disabled={submitting || !reason.trim()}>
              {submitting ? t('wallet.disputeSubmitting') : t('wallet.disputeSubmit')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
