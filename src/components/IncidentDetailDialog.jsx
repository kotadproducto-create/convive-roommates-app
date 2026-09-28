import { useState } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import { isIncidentActive } from '../lib/incidents'
import { CloseIcon } from './icons'

/**
 * Detalle de una incidencia: la información completa, su hilo de
 * comentarios y (si sigue activa y quien mira puede) el botón para
 * marcarla como solucionada. Sirve tanto para una incidencia activa como
 * para una ya archivada en el historial — el hilo y la info siguen
 * consultables igual. Mismo patrón de pop-up que DisputeContributionDialog
 * (createPortal a document.body: se abre desde dentro de IncidentCard, que
 * vive dentro de un <Reveal>).
 */
export default function IncidentDetailDialog({ incident, comments, canResolve, onClose, onResolve, onAddComment, t, dateLocale }) {
  const [commentBody, setCommentBody] = useState('')
  const [sending, setSending] = useState(false)
  const [resolving, setResolving] = useState(false)
  const active = isIncidentActive(incident)

  async function handleSend(e) {
    e.preventDefault()
    if (!commentBody.trim() || sending) return
    setSending(true)
    try {
      await onAddComment(incident.id, commentBody)
      setCommentBody('')
    } finally {
      setSending(false)
    }
  }

  async function handleResolve() {
    setResolving(true)
    try {
      await onResolve(incident.id)
    } finally {
      setResolving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 relative max-h-[90vh] overflow-y-auto flex flex-col"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-4 sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          aria-label={t('incidents.closeAria')}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        {incident.photoUrl && (
          <img src={incident.photoUrl} alt={incident.title} className="w-full h-40 object-cover rounded-xl mb-3" />
        )}

        <h3 className="font-display text-lg font-bold pr-8 break-words">{incident.title}</h3>
        <p className="text-xs text-ink-900/40 dark:text-cream-100/40 mt-0.5">
          {incident.authorName} · {format(new Date(incident.createdAt), 'd MMM, HH:mm', { locale: dateLocale })}
        </p>
        {incident.description && (
          <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mt-2 break-words">{incident.description}</p>
        )}

        {incident.resolvedAt ? (
          <p className="text-xs font-semibold text-sage-500 mt-2">
            {t('incidents.resolvedAtLabel', { date: format(new Date(incident.resolvedAt), 'd MMM, HH:mm', { locale: dateLocale }) })}
          </p>
        ) : incident.expiresAt && !active ? (
          <p className="text-xs font-semibold text-ink-900/40 dark:text-cream-100/40 mt-2">
            {t('incidents.expiredAtLabel', { date: format(new Date(incident.expiresAt), 'd MMM, HH:mm', { locale: dateLocale }) })}
          </p>
        ) : null}

        {active && canResolve && (
          <button type="button" onClick={handleResolve} disabled={resolving} className="btn-secondary text-sm mt-3 self-start">
            {resolving ? '…' : t('incidents.resolveButton')}
          </button>
        )}

        <div className="mt-4 pt-4 border-t border-ink-900/10 dark:border-cream-100/15 flex flex-col gap-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50">
            {t('incidents.commentsTitle')}
          </h4>
          {comments.length === 0 ? (
            <p className="text-sm text-ink-900/50 dark:text-cream-100/50">{t('incidents.commentsEmpty')}</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {comments.map((c) => (
                <li key={c.id} className="text-sm min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-1.5">
                    <span className="font-semibold min-w-0 break-words">{c.authorName}</span>
                    <span className="text-[11px] text-ink-900/40 dark:text-cream-100/40 shrink-0">
                      {format(new Date(c.createdAt), 'd MMM, HH:mm', { locale: dateLocale })}
                    </span>
                  </p>
                  <p className="text-ink-900/80 dark:text-cream-100/80 break-words">{c.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={handleSend} className="flex items-end gap-2 mt-4 pt-3 border-t border-ink-900/10 dark:border-cream-100/15">
          <textarea
            className="input min-h-10 flex-1 resize-none"
            placeholder={t('incidents.commentPlaceholder')}
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
            rows={1}
          />
          <button type="submit" className="btn-primary text-sm shrink-0" disabled={sending || !commentBody.trim()}>
            {t('incidents.commentSend')}
          </button>
        </form>
      </div>
    </div>,
    document.body
  )
}
