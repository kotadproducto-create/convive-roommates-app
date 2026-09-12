import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from '../context/LanguageContext'
import { currentPeriodKey } from '../lib/activities'
import { CartIcon, SparkleIcon, CloseIcon } from './icons'

function todayKey() {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Cada categoría (compras/actividades) recuerda su propio cierre del
 * día — así, cerrar el aviso de una no oculta el de otra que aparezca
 * más tarde el mismo día (ej. se agota un producto después de que ya
 * viste el de actividades). */
function isDismissedToday(key) {
  try {
    return localStorage.getItem(key) === todayKey()
  } catch {
    return false
  }
}
function markDismissedToday(key) {
  try {
    localStorage.setItem(key, todayKey())
  } catch {}
}

const TONE_BADGE = {
  coral: 'bg-coral-500',
  sky: 'bg-sky-500'
}

/**
 * Avisos al abrir Inicio de lo que le toca a ESTA persona esta semana:
 * uno por Compras (si es la persona asignada y faltan artículos) y otro
 * por Actividades/Higiene (basura+lavadora asignadas y sin completar).
 * Se muestran uno a la vez y como máximo una vez por día (localStorage),
 * para no repetirse cada vez que se abre la app en el mismo día.
 */
export default function PendingPopups({ user, floor, activities, activityCompletions, weekKey, shoppingItems }) {
  // Solo para forzar un re-render tras cerrar un aviso (escribir en
  // localStorage no dispara uno solo). El propio localStorage sigue
  // siendo la única fuente de verdad — se relee en cada render, así que
  // no hay riesgo de quedarse con un estado viejo mientras activities/
  // shoppingItems todavía están cargando.
  const [, bump] = useState(0)
  const [showQueue, setShowQueue] = useState(false)
  const { t, language } = useLanguage()

  const keyFor = (category) => (user && floor ? `convive_popup_${floor.id}_${user.id}_${category}` : null)

  const candidates = useMemo(() => {
    if (!user) return []
    const list = []

    // Progreso del período ACTUAL de una de las 3 fijas — null si esa
    // fija todavía no tiene finalización generada (piso recién
    // migrado, o esta semana no le toca ocurrencia).
    function progressFor(fixedKey) {
      const activity = activities.find((a) => a.fixedKey === fixedKey)
      if (!activity) return null
      const periodKey = currentPeriodKey(activity, weekKey)
      const completion = periodKey ? activityCompletions.find((c) => c.activityId === activity.id && c.periodKey === periodKey) : null
      return { activity, completion }
    }

    const compras = progressFor('compras')
    if (compras?.completion?.assignedUserId === user.id) {
      const missing = shoppingItems.filter((i) => i.stockLevel === 'out')
      if (missing.length > 0) {
        list.push({
          key: 'compras',
          icon: CartIcon,
          tone: 'coral',
          urgent: true,
          title: t('pendingPopups.shoppingTitle'),
          items: missing.map((i) => i.name),
          linkTo: '/compras',
          linkLabel: t('pendingPopups.goToShopping')
        })
      }
    }

    const pendingActivities = ['basura', 'lavadora']
      .map((key) => progressFor(key))
      .filter((p) => p?.completion?.assignedUserId === user.id && !p.completion.completed)

    if (pendingActivities.length > 0) {
      list.push({
        key: 'actividades',
        icon: SparkleIcon,
        tone: 'sky',
        title: t('pendingPopups.activitiesTitle'),
        bigNumber: pendingActivities.length,
        items: pendingActivities.map((p) => p.activity.title)
      })
    }

    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, activities, activityCompletions, weekKey, shoppingItems, language])

  // Cerrar una categoría la saca de `popups` (queda marcada en
  // localStorage), y la siguiente pendiente pasa a ser la primera
  // automáticamente — no hace falta llevar un índice aparte.
  const popups = candidates.filter((c) => !isDismissedToday(keyFor(c.key)))

  if (popups.length === 0) return null

  const current = popups[0]
  const Icon = current.icon

  function handleClose() {
    markDismissedToday(keyFor(current.key))
    setShowQueue(false)
    bump((n) => n + 1)
  }

  const restOfQueue = popups.slice(1)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink-900/40 backdrop-blur-sm p-4"
      onClick={handleClose}
    >
      <div
        key={current.key}
        className={`w-full sm:max-w-sm bg-white dark:bg-ink-800 rounded-2xl p-5 relative popup-drop ${
          current.urgent
            ? 'border-[3px] border-clay-500 shadow-[0_0_0_4px_theme(colors.clay.100)] dark:shadow-[0_0_0_4px_theme(colors.clay.500/20%)]'
            : 'border-2 border-ink-900 dark:border-cream-100/40'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleClose}
          aria-label={t('pendingPopups.close')}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg flex items-center justify-center hover:bg-cream-200 dark:hover:bg-ink-700"
        >
          <CloseIcon className="w-4 h-4" />
        </button>

        {current.urgent && (
          <p className="text-xs font-extrabold uppercase tracking-wide text-clay-500 mb-1.5">{t('pendingPopups.attention')}</p>
        )}

        <div
          className={`rounded-2xl flex items-center justify-center mb-3 ${
            current.urgent ? 'w-16 h-16 bg-clay-500 animate-pulse' : `w-12 h-12 ${TONE_BADGE[current.tone]}`
          }`}
        >
          <Icon className={current.urgent ? 'w-8 h-8 text-white' : 'w-6 h-6 text-white'} />
        </div>

        <h3 className={`font-display font-bold tracking-tight pr-6 ${current.urgent ? 'text-xl' : 'text-lg'}`}>{current.title}</h3>

        {current.bigNumber != null && (
          <p className="font-display text-4xl font-extrabold mt-1 mb-2">{current.bigNumber}</p>
        )}

        <ul className="flex flex-col gap-1.5 text-sm text-ink-900/70 dark:text-cream-100/70 mt-2 mb-5">
          {current.items.map((item, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${current.urgent ? 'bg-clay-500' : 'bg-ink-900/30 dark:bg-cream-100/30'}`} />
              {item}
            </li>
          ))}
        </ul>

        {current.linkTo && (
          <Link to={current.linkTo} onClick={handleClose} className="btn-danger w-full mb-2">
            {current.linkLabel}
          </Link>
        )}
        <button type="button" onClick={handleClose} className={current.linkTo ? 'btn-secondary w-full' : 'btn-primary w-full'}>
          {t('pendingPopups.understood')}
        </button>

        {restOfQueue.length > 0 && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowQueue((s) => !s)}
              className="w-full text-center text-xs font-semibold text-violet-500 hover:underline"
            >
              {showQueue
                ? t('pendingPopups.hideQueue')
                : t(restOfQueue.length > 1 ? 'pendingPopups.queueMorePlural' : 'pendingPopups.queueMoreSingular', {
                    count: restOfQueue.length
                  })}
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                showQueue ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <div className="overflow-hidden">
                <div className="mt-2 pt-2 border-t border-ink-900/10 dark:border-cream-100/15 flex flex-col gap-2">
                  {restOfQueue.map((p) => (
                    <div key={p.key}>
                      <p className="text-xs font-bold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-1">{p.title}</p>
                      <ul className="flex flex-col gap-1 text-sm text-ink-900/70 dark:text-cream-100/70">
                        {p.items.map((item, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full bg-ink-900/30 dark:bg-cream-100/30 shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
