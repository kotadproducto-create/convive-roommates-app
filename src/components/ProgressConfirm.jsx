import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useToast } from '../context/ToastContext'
import { useLanguage } from '../context/LanguageContext'
import { usePointsFx } from '../context/PointsFxContext'
import { activeRoutineMarks, occurrencePoints, canUserMark } from '../lib/activities'

/** Pop-up de confirmación (mismo patrón fijo que ConfirmPotDialog). */
export function ConfirmDialog({ title, body, confirmLabel, onCancel, onConfirm, t }) {
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirmClick(e) {
    // Punto de la pantalla donde se tocó: de ahí salen las fichas si se ganan puntos.
    const r = e.currentTarget.getBoundingClientRect()
    setSubmitting(true)
    try {
      await onConfirm({ x: r.left + r.width / 2, y: r.top + r.height / 2 })
    } finally {
      setSubmitting(false)
    }
  }

  // En document.body: si se abre dentro de una tarjeta con transform (Convives,
  // animaciones de entrada), un ancestro con transform encierra a los
  // elementos `fixed` y el pop-up quedaba del tamaño de la tarjeta. Los
  // eventos de puntero no deben subir al arrastre de esa tarjeta.
  return createPortal(
    <div
      className="fixed inset-0 z-40 bg-ink-900/40 backdrop-blur-sm flex items-end sm:items-center sm:justify-center"
      onClick={onCancel}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full sm:max-w-sm sm:rounded-2xl bg-cream-100 dark:bg-ink-800 border-t-[2.5px] sm:border-2 border-ink-900 dark:border-cream-100/40 rounded-t-2xl p-5 pb-8 sm:pb-5 max-h-[90vh] overflow-y-auto"
      >
        <div className="w-9 h-1.5 rounded-full bg-ink-900/15 dark:bg-cream-100/15 mx-auto mb-4 sm:hidden" />
        <h3 className="font-display text-lg font-bold mb-2">{title}</h3>
        <p className="text-sm text-ink-900/70 dark:text-cream-100/70 mb-5">{body}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary text-sm flex-1" onClick={onCancel} disabled={submitting}>
            {t('activities.confirmCancel')}
          </button>
          <button type="button" className="btn-primary text-sm flex-1" onClick={handleConfirmClick} disabled={submitting}>
            {submitting ? t('activities.confirmSaving') : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/**
 * Marcar como hecho / Deshacer siempre pasan por un pop-up de
 * confirmación. `ask(completion, delta)` lo abre (delta 1 = marcar, -1 =
 * deshacer); al confirmar llama a setActivityProgress y avisa con un
 * toast si no se pudo (todavía no toca / la marca es de otra persona) o
 * si se completó la actividad. Quien lo use renderiza `dialog`.
 */
export function useProgressConfirm() {
  const { user } = useAuth()
  const { activities, activityMarks, members, setActivityProgress, virtualMemberIds } = useData()
  const { showToast } = useToast()
  const { t } = useLanguage()
  const { fly } = usePointsFx()
  const [pending, setPending] = useState(null) // { completion, delta }

  function ask(completion, delta) {
    if (!completion) return
    // Marcar hecho es solo del responsable del turno: se avisa sin abrir el pop-up.
    const activity = activities.find((a) => a.id === completion.activityId)
    if (delta > 0 && activity && !canUserMark(activity, completion, user?.id, virtualMemberIds)) {
      const name = members.find((m) => m.id === (completion.assignedUserId || activity.assignedUserId))?.name || ''
      showToast(t('activities.notYourTurnToast', { name }), 'default')
      return
    }
    setPending({ completion, delta })
  }

  let dialog = null
  if (pending) {
    const { completion, delta } = pending
    const activity = activities.find((a) => a.id === completion.activityId)
    const title = activity?.title || ''
    const target = activity?.timesPerWeek || 1
    const timesDone = completion.timesDone || 0
    let heading, body, confirmLabel
    let earned = 0
    let behalfName = null
    if (delta > 0) {
      // Actividad de un perfil virtual (no usa la app): cualquiera la marca, sin puntos.
      const assigneeId = completion.assignedUserId || activity?.assignedUserId
      behalfName = virtualMemberIds.has(assigneeId) ? members.find((m) => m.id === assigneeId)?.name || '' : null
      earned = behalfName !== null ? 0 : occurrencePoints(activity?.points, timesDone, target)
      heading = t('activities.confirmMarkTitle')
      body =
        behalfName !== null
          ? t('activities.confirmMarkBodyBehalf', { title, name: behalfName })
          : t(earned ? 'activities.confirmMarkBody' : 'activities.confirmMarkBodyNoPoints', { title, points: earned })
      confirmLabel = t('activities.confirmMarkYes')
    } else {
      const top = activeRoutineMarks(activityMarks, completion.id).at(-1)
      const who = top?.markedBy ? members.find((m) => m.id === top.markedBy) : null
      const name = top?.markedBy === user?.id ? t('activities.confirmYou') : who?.name || ''
      heading = t('activities.confirmUndoTitle')
      body = top?.points
        ? t('activities.confirmUndoBody', { title, points: top.points, name })
        : t('activities.confirmUndoBodyNoPoints', { title })
      confirmLabel = t('activities.confirmUndoYes')
    }

    dialog = (
      <ConfirmDialog
        title={heading}
        body={body}
        confirmLabel={confirmLabel}
        t={t}
        onCancel={() => setPending(null)}
        onConfirm={async (origin) => {
          const result = await setActivityProgress(completion, delta)
          setPending(null)
          if (result?.ok === false) {
            showToast(t(result.reason === 'not_yours' ? 'activities.notYoursToast' : 'activities.notYetToast'), 'default')
          } else if (delta > 0) {
            fly(earned, origin)
            if (timesDone + 1 >= target && behalfName === null) showToast(t('taskCard.completedToast', { label: title, points: earned }), 'success')
          }
        }}
      />
    )
  }

  return { ask, dialog }
}
