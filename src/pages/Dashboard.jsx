import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import ActivityCard from '../components/ActivityCard'
import { useSpaceUse, formatLeft } from '../components/SharedSpaces'
import { SHARED_SPACE_BY_KEY } from '../lib/sharedSpaces'
import { useToast } from '../context/ToastContext'
import CalendarView from '../components/CalendarView'
import Reveal from '../components/Reveal'
import { useAuth } from '../context/AuthContext'
import { useData } from '../context/DataContext'
import { useLanguage } from '../context/LanguageContext'
import { getMondayOfWeek } from '../lib/rotation'
import { currentPeriodKey, floorKeeperFor } from '../lib/activities'
import { AlertIcon } from '../components/icons'
import { format } from 'date-fns'

const FIXED_ORDER = ['compras', 'basura', 'lavadora']

export default function Dashboard() {
  const { user } = useAuth()
  const {
    floor,
    members,
    activities,
    activityCompletions,
    shoppingItems,
    shoppingPurchases,
    potContributions,
    notifications,
    activityMarks,
    extraCounts,
    addActivityExtra,
    removeActivityExtra,
    startSharedSpaceUse,
    awayUserIds,
    weekKey
  } = useData()
  const { showToast } = useToast()
  // La lavadora es un "espacio compartido" (Actividades → Espacios compartidos):
  // este botón usa la misma lógica, así que también deja el espacio "en uso".
  const washer = useSpaceUse('washer')
  const { t, dateLocale } = useLanguage()

  // "/calendario?fecha=YYYY-MM-DD" abre el calendario directo en ese día
  // (lo usa "Racha de la semana" en Inicio). Se lee una sola vez al
  // entrar y se limpia de la URL para que "atrás" vuelva a Inicio y un
  // refresh no re-fuerce esa fecha.
  const [searchParams, setSearchParams] = useSearchParams()
  const [initialDate] = useState(() => {
    const raw = searchParams.get('fecha')
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
    const d = new Date(`${raw}T00:00:00`)
    return Number.isNaN(d.getTime()) ? null : d
  })
  useEffect(() => {
    if (searchParams.has('fecha')) setSearchParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const monday = getMondayOfWeek(weekKey)
  // Persona encargada del piso esta semana: a quien le toca en el orden de
  // rotación (sin quienes están fuera), ver floorKeeperFor.
  const floorKeeper = useMemo(() => {
    const order = (floor?.rotationOrder || []).filter((id) => !awayUserIds.has(id))
    const id = floorKeeperFor(floor, order, weekKey)
    return members.find((m) => m.id === id) || null
  }, [floor, members, awayUserIds, weekKey])
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)

  const memberById = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m])), [members])

  async function handleWasher() {
    try {
      const result = await startSharedSpaceUse('washer', SHARED_SPACE_BY_KEY.washer.defaultMinutes)
      if (result?.ok) showToast(t('calendar.washerNotified'), 'success')
    } catch (err) {
      console.error('startSharedSpaceUse', err)
      showToast(t('sharedSpaces.errorToast'), 'error')
    }
  }

  const fixedActivities = useMemo(
    () =>
      activities
        .filter((a) => a.fixedKey)
        .slice()
        .sort((a, b) => FIXED_ORDER.indexOf(a.fixedKey) - FIXED_ORDER.indexOf(b.fixedKey)),
    [activities]
  )
  const fixedWithCompletion = useMemo(
    () =>
      fixedActivities.map((activity) => {
        const periodKey = currentPeriodKey(activity, weekKey)
        const completion = periodKey ? activityCompletions.find((c) => c.activityId === activity.id && c.periodKey === periodKey) : null
        return { activity, completion }
      }),
    [fixedActivities, activityCompletions, weekKey]
  )
  const doneCount = fixedWithCompletion.filter(({ completion }) => completion?.completed).length
  const outOfStockItems = shoppingItems.filter((i) => i.recurring && i.stockLevel === 'out')

  return (
    <AppLayout title={t('calendar.title')}>
      {outOfStockItems.length > 0 && (
        <Reveal>
          <Link to="/compras" className="card p-3 mb-5 flex items-center gap-2 border-clay-500/50 hover:-translate-y-0.5 transition-transform">
            <AlertIcon className="w-5 h-5 text-clay-500 shrink-0" />
            <p className="text-sm font-medium text-clay-500">
              {t('calendar.restockBanner', { items: outOfStockItems.map((i) => i.name).join(', ') })}
            </p>
          </Link>
        </Reveal>
      )}

      <Reveal as="section" className="mb-8">
        <h2 className="font-display text-lg font-bold mb-3">{t('calendar.calendarHeading')}</h2>
        <CalendarView
          floor={floor}
          memberById={memberById}
          activities={activities}
          activityCompletions={activityCompletions}
          potContributions={potContributions}
          shoppingPurchases={shoppingPurchases}
          shoppingItems={shoppingItems}
          notifications={notifications}
          activityMarks={activityMarks}
          currentUserId={user?.id}
          initialDate={initialDate}
        />
      </Reveal>

      {/* Encabezado: dónde estamos */}
      <Reveal>
        <div className="card bg-violet-100 dark:bg-violet-700/20 p-4 mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-600 dark:text-violet-200 mb-0.5">{t('calendar.today')}</p>
          <h2 className="font-display text-2xl font-bold tracking-tight">{t('calendar.greeting', { name: user?.name?.split(' ')[0] })}</h2>
          <p className="text-sm text-ink-900/60 dark:text-cream-100/60">
            {t('calendar.weekOf', {
              start: format(monday, t('calendar.dayMonthFormat'), { locale: dateLocale }),
              end: format(sunday, t('calendar.dayMonthFormat'), { locale: dateLocale }),
              floor: floor?.name
            })}
          </p>
          {floorKeeper && (
            <p className="text-sm font-semibold mt-1">{t('calendar.floorKeeper', { name: floorKeeper.name })}</p>
          )}
        </div>
      </Reveal>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start mb-8">
        {/* Zona primaria: qué tengo pendiente */}
        <section className="lg:col-span-2">
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display text-lg font-bold">{t('calendar.weekTasksTitle')}</h3>
            <span className="text-xs font-semibold text-ink-900/50 dark:text-cream-100/50">
              {t('calendar.completedCount', { done: doneCount, total: fixedWithCompletion.length })}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fixedWithCompletion.map(({ activity, completion }, i) => (
              <Reveal key={activity.id} delay={i * 70}>
                <ActivityCard
                  activity={activity}
                  completion={completion}
                  memberById={memberById}
                  rotationOrder={floor?.rotationOrder}
                  extras={completion ? extraCounts[completion.id] || 0 : 0}
                  showProgress={!!completion}
                  onExtra={() => completion && addActivityExtra(completion)}
                  onUndoExtra={() => completion && removeActivityExtra(completion.id)}
                  t={t}
                  dateLocale={dateLocale}
                />
              </Reveal>
            ))}
          </div>
        </section>

        {/* Zona secundaria: lavadora */}
        <aside className="flex flex-col gap-4">
          <Reveal delay={150}>
          <div className="card p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-900/50 dark:text-cream-100/50 mb-1">{t('calendar.washerLabel')}</p>
            <p className="text-sm mb-3">{t('calendar.washerHint')}</p>
            {washer.current && (
              <p className="text-sm font-semibold mb-3">
                {t('sharedSpaces.inUseBy', { name: washer.user?.name || t('sharedSpaces.someone'), space: t('sharedSpaces.spaceRef.washer') })}
                <span className="block text-xs font-normal text-ink-900/60 dark:text-cream-100/60">
                  {t('sharedSpaces.untilTime', { time: format(new Date(washer.current.endsAt), 'HH:mm'), left: formatLeft(washer.left, t) })}
                </span>
              </p>
            )}
            <button className="btn-primary text-sm w-full disabled:opacity-40 disabled:cursor-not-allowed" disabled={!!washer.current} onClick={handleWasher}>
              {t('calendar.washerCta')}
            </button>
          </div>
          </Reveal>
        </aside>
      </div>
    </AppLayout>
  )
}
