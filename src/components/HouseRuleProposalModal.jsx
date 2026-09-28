import { useState } from 'react'
import { createPortal } from 'react-dom'
import { RULE_CATEGORIES } from '../lib/houseRules'
import { POLL_DURATION_OPTIONS, DEFAULT_POLL_HOURS } from '../lib/polls'
import { CloseIcon } from './icons'

/**
 * Proponer crear, modificar o eliminar una norma — cualquier compañero
 * puede hacerlo (no solo un admin). No cambia nada todavía: `onSubmit`
 * llama a proposeHouseRule (DataContext.jsx), que crea una consulta de
 * Votaciones (kind:'house_rule') con las mismas opciones Aprobar/Rechazar
 * y duraciones que cualquier otra consulta — el cambio real solo se
 * aplica si el piso la aprueba. Mismo patrón de pop-up que
 * DisputeContributionDialog/CreatePollModal.
 */
export default function HouseRuleProposalModal({ mode, rule, onClose, onSubmit, t }) {
  const [category, setCategory] = useState(rule?.category || RULE_CATEGORIES[0].key)
  const [title, setTitle] = useState(rule?.title || '')
  const [description, setDescription] = useState(rule?.description || '')
  const [durationHours, setDurationHours] = useState(DEFAULT_POLL_HOURS)
  const [submitting, setSubmitting] = useState(false)

  const isDelete = mode === 'delete'
  const canSubmit = isDelete || (title.trim().length > 0 && description.trim().length > 0)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      await onSubmit({
        action: mode,
        ruleId: rule?.id || null,
        category,
        title: isDelete ? rule.title : title.trim(),
        description: isDelete ? rule.description : description.trim(),
        durationHours
      })
    } finally {
      setSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-md sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 relative max-h-[90vh] overflow-y-auto flex flex-col gap-3"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-1 sm:hidden" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        <h3 className="font-display text-lg font-bold pr-8">
          {mode === 'create' ? t('houseRules.proposeNewTitle') : mode === 'edit' ? t('houseRules.proposeEditTitle') : t('houseRules.proposeDeleteTitle')}
        </h3>

        {isDelete ? (
          <div className="bg-clay-500/10 rounded-xl px-3 py-2.5">
            <p className="text-sm font-semibold break-words">{rule.title}</p>
            <p className="text-xs text-ink-900/60 dark:text-cream-100/60 mt-1 break-words">{rule.description}</p>
          </div>
        ) : (
          <>
            <div>
              <label className="text-sm block mb-1.5">{t('houseRules.categoryLabel')}</label>
              <div className="grid grid-cols-2 gap-2">
                {RULE_CATEGORIES.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className={`text-sm font-semibold px-3 py-2 rounded-xl border-2 text-left min-w-0 ${
                      category === c.key
                        ? 'bg-gold-100 dark:bg-gold-400/25 border-ink-900 dark:border-cream-100/50 text-ink-900 dark:text-cream-100'
                        : 'border-ink-900/15 dark:border-cream-100/20 text-ink-900/70 dark:text-cream-100/70'
                    }`}
                  >
                    {c.icon} {t(c.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <input
              className="input"
              placeholder={t('houseRules.titlePlaceholder')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              required
            />
            <textarea
              className="input min-h-20"
              placeholder={t('houseRules.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              required
            />
          </>
        )}

        <div>
          <label className="text-sm block mb-1.5">{t('houseRules.durationLabel')}</label>
          <div className="grid grid-cols-3 gap-2">
            {POLL_DURATION_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setDurationHours(h)}
                className={`text-sm font-semibold px-3 py-2 rounded-xl border-2 ${
                  durationHours === h
                    ? 'bg-gold-100 dark:bg-gold-400/25 border-ink-900 dark:border-cream-100/50 text-ink-900 dark:text-cream-100'
                    : 'border-ink-900/15 dark:border-cream-100/20 text-ink-900/70 dark:text-cream-100/70'
                }`}
              >
                {t('houseRules.durationHoursOption', { hours: h })}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-ink-900/50 dark:text-cream-100/50">{t('houseRules.proposalHint')}</p>

        <div className="flex gap-2 mt-1">
          <button type="button" className="btn-secondary text-sm flex-1" onClick={onClose} disabled={submitting}>
            {t('houseRules.cancel')}
          </button>
          <button type="submit" className={`text-sm flex-1 ${isDelete ? 'btn-danger' : 'btn-primary'}`} disabled={submitting || !canSubmit}>
            {submitting ? t('houseRules.sending') : t('houseRules.sendToVote')}
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}
